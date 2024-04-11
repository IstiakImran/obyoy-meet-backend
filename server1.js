// server.js

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Store active meetings and their participants
const meetings = {};

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('create-new-meeting', ({ email, meetingCode }) => {
    // Generate meeting code if not provided
    if (!meetingCode) {
      meetingCode = Math.random().toString(36).substr(2, 6);
    }

    // Check if meeting id already exists
    if (meetings[meetingCode]) {
      socket.emit('meeting-error', { message: 'Meeting ID already exists' });
      return;
    }

    // Create new meeting with admin as the first participant
    meetings[meetingCode] = { admin: email, participants: {} };

    // Join the meeting room
    socket.join(meetingCode);

    // Emit success message to admin
    socket.emit('meeting-created', { meetingCode, email });
  });

  socket.on('join-meeting', ({ meetingCode, email }) => {
    // Check if meeting exists
    if (!meetings[meetingCode]) {
      socket.emit('meeting-error', { message: 'Meeting does not exist' });
      return;
    }
  
    // Join the meeting room
    socket.join(meetingCode);
  
    // Add participant to the meeting
    if (!meetings[meetingCode].participants[socket.id]) {
      meetings[meetingCode].participants[socket.id] = { email, stream: null };
    }
  
    // Notify admin and other participants about the new participant
    io.to(meetingCode).emit('participant-joined', { email, socketId: socket.id });
  
    // Emit success message to the new participant
    socket.emit('meeting-joined', { meetingCode, email });
  
    // Send current participants' streams to the new participant
    for (const participantId in meetings[meetingCode].participants) {
      if (participantId !== socket.id && meetings[meetingCode].participants[participantId].stream) {
        socket.emit('participant-stream', { userId: participantId, stream: meetings[meetingCode].participants[participantId].stream });
      }
    }
  
    // Request offers from other participants
    for (const participantId in meetings[meetingCode].participants) {
      if (participantId !== socket.id) {
        io.to(participantId).emit('request-offer', { target: socket.id });
      }
    }
  });

  socket.on('toggle-mic', ({ meetingCode, userId, mute }) => {
    io.to(meetingCode).emit('mic-toggled', { userId, mute });
  });

  socket.on('toggle-camera', ({ meetingCode, userId, disableCamera }) => {
    io.to(meetingCode).emit('camera-toggled', { userId, disableCamera });
  });

  socket.on('hang-up', ({ meetingCode, userId }) => {
    io.to(meetingCode).emit('participant-hanged-up', { userId });
  });

  socket.on('toggle-chat', ({ meetingCode, showChat }) => {
    io.to(meetingCode).emit('chat-toggled', { showChat });
  });
  // Emit the participant's stream to all participants in the meeting
  socket.on('stream-offer', ({ meetingCode, userId, stream }) => {
    if (!meetings[meetingCode] || !meetings[meetingCode].participants[userId]) {
      return;
    }
  
    meetings[meetingCode].participants[userId].stream = stream;
    io.to(meetingCode).emit('participant-stream', { userId, stream });
  });
// Relay WebRTC offers
socket.on('offer', (data) => {
    io.to(data.target).emit('offer', { sender: socket.id, sdp: data.sdp });
  });

  // Relay WebRTC answers
  socket.on('answer', (data) => {
    io.to(data.target).emit('answer', { sender: socket.id, sdp: data.sdp });
  });

  // Relay ICE candidates
  socket.on('ice-candidate', (data) => {
    io.to(data.target).emit('ice-candidate', { sender: socket.id, candidate: data.candidate });
  });

  // Broadcast media stream to other participants
  socket.on('stream-offer', ({ meetingCode, userId, stream }) => {
    socket.broadcast.to(meetingCode).emit('participant-stream', { userId, stream });
  });


  socket.on('disconnect', () => {
    console.log('A user disconnected');

    // Remove participant from all meetings
    for (const meetingCode in meetings) {
      if (meetings[meetingCode].participants[socket.id]) {
        const email = meetings[meetingCode].participants[socket.id];
        delete meetings[meetingCode].participants[socket.id];
        io.to(meetingCode).emit('participant-left', { email });
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
