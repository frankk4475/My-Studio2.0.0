let io;

module.exports = {
  init: (server) => {
    const { Server } = require('socket.io');
    io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    io.on('connection', (socket) => {
      console.log('⚡ User connected to Socket.io:', socket.id);
      
      socket.on('disconnect', () => {
        console.log('👋 User disconnected from Socket.io');
      });
    });

    return io;
  },
  getIo: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  },
  emit: (event, data) => {
    if (io) {
      io.emit(event, data);
    }
  }
};
