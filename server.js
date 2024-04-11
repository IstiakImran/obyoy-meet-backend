
import express from 'express';
import pkg from 'body-parser';
const { json, urlencoded } = pkg;
import { createServer } from 'http';
import { Server } from 'socket.io';
import pkgs from 'wrtc';
import cors from 'cors';
const { RTCPeerConnection, RTCSessionDescription } = pkgs;

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });

let senderStream;

app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cors({
    origin: 'http://localhost:5173' // Only allow this origin to access the API
  }));

app.post("/consumer", async (req, res) => {
    const peer = new RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.stunprotocol.org"
            }
        ]
    });
    const desc = new RTCSessionDescription(req.body.sdp);
    await peer.setRemoteDescription(desc);
    senderStream.getTracks().forEach(track => peer.addTrack(track, senderStream));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    const payload = {
        sdp: peer.localDescription
    }

    res.json(payload);
});

app.post('/broadcast', async (req, res) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: ["stun:stun.l.google.com:19302"]
        }
      ]
    });
  
    peer.ontrack = (e) => handleTrackEvent(e, peer);
  
    const desc = new RTCSessionDescription(req.body.sdp);
    await peer.setRemoteDescription(desc);
  
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
  
    const payload = {
      sdp: peer.localDescription
    }
  
    res.json(payload);
  });
  
  function handleTrackEvent(e, peer) {
    senderStream = e.streams[0];
  }

io.on('connection', socket => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

http.listen(5000, () => console.log('server started'));

