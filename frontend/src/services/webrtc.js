class WebRTCService {
  constructor() {
    this.localStream = null;
    this.peerConnections = new Map(); // socketId -> RTCPeerConnection
    this.socket = null;
    this.audioElements = new Map(); // socketId -> HTMLAudioElement
    this.onStreamUpdate = null;
  }

  async initLocalMicrophone() {
    if (this.localStream) return this.localStream;
    try {
      // STRICT REQUIREMENT: Audio ONLY. NEVER request video.
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      return this.localStream;
    } catch (err) {
      console.error('Microphone access denied/error:', err);
      throw new Error('Microphone permission is required for this activity. Please enable microphone access in browser settings.');
    }
  }

  setupSocketSignaling(socket) {
    this.socket = socket;

    // Incoming WebRTC offer
    socket.on('webrtc-offer', async ({ senderSocketId, offer }) => {
      try {
        const pc = this.createPeerConnection(senderSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc-answer', {
          targetSocketId: senderSocketId,
          answer
        });
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
    });

    // Incoming WebRTC answer
    socket.on('webrtc-answer', async ({ senderSocketId, answer }) => {
      try {
        const pc = this.peerConnections.get(senderSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (err) {
        console.error('Error handling WebRTC answer:', err);
      }
    });

    // Incoming ICE candidate
    socket.on('webrtc-ice-candidate', async ({ senderSocketId, candidate }) => {
      try {
        const pc = this.peerConnections.get(senderSocketId);
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error handling ICE candidate:', err);
      }
    });

    // Remote user joined
    socket.on('user-joined', async ({ socketId }) => {
      try {
        const pc = this.createPeerConnection(socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('webrtc-offer', {
          targetSocketId: socketId,
          offer
        });
      } catch (err) {
        console.error('Error initiating WebRTC call:', err);
      }
    });

    // Remote user left
    socket.on('user-left', ({ socketId }) => {
      this.closePeerConnection(socketId);
    });
  }

  createPeerConnection(targetSocketId) {
    if (this.peerConnections.has(targetSocketId)) {
      return this.peerConnections.get(targetSocketId);
    }

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);

    // Add local microphone audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('webrtc-ice-candidate', {
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    // Remote audio stream received
    pc.ontrack = (event) => {
      let audio = this.audioElements.get(targetSocketId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        this.audioElements.set(targetSocketId, audio);
      }
      audio.srcObject = event.streams[0];
    };

    this.peerConnections.set(targetSocketId, pc);
    return pc;
  }

  closePeerConnection(socketId) {
    const pc = this.peerConnections.get(socketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(socketId);
    }
    const audio = this.audioElements.get(socketId);
    if (audio) {
      audio.srcObject = null;
      this.audioElements.delete(socketId);
    }
  }

  stopAll() {
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();

    this.audioElements.forEach(audio => {
      audio.srcObject = null;
    });
    this.audioElements.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}

export const webrtcService = new WebRTCService();
