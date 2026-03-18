use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem, MasterPty, Child};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

struct PtyInstance {
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
    reader: Arc<Mutex<Box<dyn Read + Send>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

#[derive(Clone)]
pub struct PtyManager {
    instances: Arc<Mutex<HashMap<String, PtyInstance>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            instances: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn spawn(&self, shell: &str, cwd: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let pty_system = NativePtySystem::default();
        let pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let mut cmd = CommandBuilder::new(shell);
        cmd.cwd(cwd);
        // Set environment for interactive shell
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        let child = pair.slave.spawn_command(cmd)?;
        let reader = pair.master.try_clone_reader()?;
        let writer = pair.master.take_writer()?;

        let id = Uuid::new_v4().to_string();

        let instance = PtyInstance {
            master: pair.master,
            child,
            reader: Arc::new(Mutex::new(reader)),
            writer: Arc::new(Mutex::new(writer)),
        };

        self.instances.lock().unwrap().insert(id.clone(), instance);
        Ok(id)
    }

    pub fn read(&self, id: &str, buf: &mut [u8]) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        // Clone the Arc THEN drop instances lock — prevents deadlock with write()
        let reader = {
            let instances = self.instances.lock().unwrap();
            let instance = instances.get(id).ok_or("PTY not found")?;
            Arc::clone(&instance.reader)
        }; // instances lock released here
        let mut reader = reader.lock().unwrap();
        let n = reader.read(buf)?;
        Ok(n)
    }

    pub fn write(&self, id: &str, data: &[u8]) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Clone the Arc THEN drop instances lock — prevents deadlock with read()
        let writer = {
            let instances = self.instances.lock().unwrap();
            let instance = instances.get(id).ok_or("PTY not found")?;
            Arc::clone(&instance.writer)
        }; // instances lock released here
        let mut writer = writer.lock().unwrap();
        writer.write_all(data)?;
        writer.flush()?;
        Ok(())
    }

    pub fn resize(
        &self,
        id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let instances = self.instances.lock().unwrap();
        let instance = instances.get(id).ok_or("PTY not found")?;
        instance.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }

    pub fn kill(&self, id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut instances = self.instances.lock().unwrap();
        if let Some(mut instance) = instances.remove(id) {
            instance.child.kill()?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    fn default_shell() -> String {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }

    fn home_dir() -> String {
        std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string())
    }

    #[test]
    fn new() {
        let mgr = PtyManager::new();
        let instances = mgr.instances.lock().unwrap();
        assert!(instances.is_empty());
    }

    #[test]
    fn spawn() {
        let mgr = PtyManager::new();
        let id = mgr.spawn(&default_shell(), &home_dir()).expect("spawn failed");
        // UUID v4 format: 8-4-4-4-12 hex chars
        assert_eq!(id.len(), 36);
        assert_eq!(id.chars().filter(|c| *c == '-').count(), 4);
        // Cleanup
        let _ = mgr.kill(&id);
    }

    #[test]
    fn write_read() {
        let mgr = PtyManager::new();
        let id = mgr.spawn(&default_shell(), &home_dir()).expect("spawn failed");

        // Wait for shell to initialize
        thread::sleep(Duration::from_millis(500));

        // Drain any initial shell output
        let mut drain = [0u8; 4096];
        // Non-blocking drain: read whatever is available
        // The PTY read may block, so we use a timeout approach via a thread
        let mgr_clone = mgr.clone();
        let id_clone = id.clone();
        let _drain_handle = thread::spawn(move || {
            let _ = mgr_clone.read(&id_clone, &mut drain);
        });
        thread::sleep(Duration::from_millis(300));
        // drain_handle may still be blocking, that's ok

        mgr.write(&id, b"echo hello\n").expect("write failed");
        thread::sleep(Duration::from_millis(500));

        // Read in a loop with a timeout
        let mgr_clone = mgr.clone();
        let id_clone = id.clone();
        let read_handle = thread::spawn(move || {
            let mut collected = String::new();
            let start = std::time::Instant::now();
            while start.elapsed() < Duration::from_secs(3) {
                let mut buf = [0u8; 4096];
                match mgr_clone.read(&id_clone, &mut buf) {
                    Ok(n) if n > 0 => {
                        collected.push_str(&String::from_utf8_lossy(&buf[..n]));
                        if collected.contains("hello") {
                            break;
                        }
                    }
                    _ => break,
                }
            }
            collected
        });

        let output = read_handle.join().expect("read thread panicked");
        assert!(
            output.contains("hello"),
            "expected output to contain 'hello', got: {}",
            output
        );

        let _ = mgr.kill(&id);
    }

    #[test]
    fn resize() {
        let mgr = PtyManager::new();
        let id = mgr.spawn(&default_shell(), &home_dir()).expect("spawn failed");
        thread::sleep(Duration::from_millis(200));

        let result = mgr.resize(&id, 120, 40);
        assert!(result.is_ok(), "resize failed: {:?}", result.err());

        let _ = mgr.kill(&id);
    }

    #[test]
    fn kill() {
        let mgr = PtyManager::new();
        let id = mgr.spawn(&default_shell(), &home_dir()).expect("spawn failed");
        thread::sleep(Duration::from_millis(200));

        mgr.kill(&id).expect("kill failed");

        // After kill, the instance is removed, so read should fail with "PTY not found"
        let mut buf = [0u8; 1024];
        let result = mgr.read(&id, &mut buf);
        assert!(result.is_err());
    }

    #[test]
    fn multiple() {
        let mgr = PtyManager::new();
        let id1 = mgr.spawn(&default_shell(), &home_dir()).expect("spawn 1 failed");
        let id2 = mgr.spawn(&default_shell(), &home_dir()).expect("spawn 2 failed");
        let id3 = mgr.spawn(&default_shell(), &home_dir()).expect("spawn 3 failed");

        assert_ne!(id1, id2);
        assert_ne!(id2, id3);
        assert_ne!(id1, id3);

        let instances = mgr.instances.lock().unwrap();
        assert_eq!(instances.len(), 3);
        drop(instances);

        let _ = mgr.kill(&id1);
        let _ = mgr.kill(&id2);
        let _ = mgr.kill(&id3);
    }
}
