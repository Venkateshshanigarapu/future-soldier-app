const { spawn } = require('child_process');
const path = require('path');

console.log('Restarting server...');

// Kill existing node processes (be careful with this in production)
const { exec } = require('child_process');

exec('taskkill /F /IM node.exe', (error, stdout, stderr) => {
  if (error) {
    console.log('No existing node processes to kill');
  } else {
    console.log('Killed existing node processes');
  }
  
  // Wait a moment then start the server
  setTimeout(() => {
    console.log('Starting server...');
    const server = spawn('node', ['index.js'], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    server.on('error', (err) => {
      console.error('Failed to start server:', err);
    });
    
    server.on('exit', (code) => {
      console.log(`Server exited with code ${code}`);
    });
  }, 2000);
});
