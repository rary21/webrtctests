// our username
var name;
var connectedUser;
var isServer;

// connecting to our signaling server
var conn = new WebSocket('wss://rarywebrtc.xyz:8080');

conn.onopen = function() {
  console.log('Connected to the signaling server');
};

// when we got a message from a signaling server
conn.onmessage = function(msg) {
  console.log('Got message', msg.data);

  var data = JSON.parse(msg.data);

  switch (data.type) {
    case 'login':
      handleLogin(data.success);
      break;
    // when somebody wants to call us
    case 'offer':
      handleOffer(data.offer, data.name);
      break;
    case 'answer':
      handleAnswer(data.answer);
      break;
    // when a remote peer sends an ice candidate to us
    case 'candidate':
      handleCandidate(data.candidate);
      break;
    case 'leave':
      if (!isServer)
        handleLeave();
      break;
    default:
      break;
  }
};

conn.onerror = function(err) {
  console.log('Got error', err);
};

// alias for sending JSON encoded messages
function send(message) {
  // attach the other peer username to our messages
  if (connectedUser) {
    message.name = connectedUser;
  }

  conn.send(JSON.stringify(message));
};

//******
// UI selectors block
//******

var loginPage = document.querySelector('#loginPage');
var usernameInput = document.querySelector('#usernameInput');
var loginServerBtn = document.querySelector('#loginServerBtn');
var loginClientBtn = document.querySelector('#loginClientBtn');

var callPage = document.querySelector('#callPage');
var callToUsernameInput = document.querySelector('#callToUsernameInput');
var callBtn = document.querySelector('#callBtn');

var hangUpBtn = document.querySelector('#hangUpBtn');

// hide call page
callPage.style.display = 'none';

// Login when the user clicks the button
loginServerBtn.addEventListener('click', function(event) {
  name = usernameInput.value;
  isServer = true;

  if (name.length > 0) {
    send({type: 'login', name: name});
  }
});

// Login when the user clicks the button
loginClientBtn.addEventListener('click', function(event) {
  name = usernameInput.value;
  isServer = false;

  if (name.length > 0) {
    send({type: 'login', name: name});
  }
});

function handleLogin(success) {
  if (success === false) {
    alert('Ooops...try a different username');
  } else {
    loginPage.style.display = 'none';
    callPage.style.display = 'block';

    //**********************
    // Starting a peer connection
    //**********************
    // using Google public stun server
    var configuration = {
      'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
    };

    yourConn = new RTCPeerConnection(configuration);

    // Setup ice handling
    yourConn.onicecandidate = function(event) {
      if (event.candidate) {
        send({type: 'candidate', candidate: event.candidate});
      }
    };

    // getting local video stream
    if (isServer) {
      const promise =
          navigator.mediaDevices.getUserMedia({video: true, audio: false});
      promise.then(successCallback).catch(errorCallback);
    } else {

      // when a remote user adds stream to the peer connection, we display it
      yourConn.ontrack = function(e) {
        video.srcObject = e.streams[0];
      };

      yourConn.addTransceiver('video', {direction: 'recvonly'});
    }

    function successCallback(myStream) {
      stream = myStream;

      // displaying local video stream on the page
      if (isServer)
        video.srcObject = stream;

      // setup stream listening
      // this is obselete
      // yourConn.addStream(stream);
      stream.getTracks().forEach(function(track) {
        yourConn.addTransceiver(track, {
          streams: [stream],
          direction: 'sendonly'
        });
      });

    }
    function errorCallback(error) {
      alert(error);
    }
  }
};

video = document.querySelector('#video');

var yourConn;
var stream;

// initiating a call
callBtn.addEventListener('click', function() {
  var callToUsername = callToUsernameInput.value;

  if (callToUsername.length > 0) {
    connectedUser = callToUsername;

    // create an offer
    yourConn.createOffer().then(function(offer) {
      send({type: 'offer', offer: offer});

      yourConn.setLocalDescription(offer);
    })
  }
});

// when somebody sends us an offer
function handleOffer(offer, name) {
  connectedUser = name;
  yourConn.setRemoteDescription(new RTCSessionDescription(offer));

  if (stream) {
    yourConn.getTransceivers().forEach(transceiver => {
      const { kind } = transceiver.receiver.track;
      const [ track ] = kind === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
      transceiver.sender.replaceTrack(track);
      transceiver.direction = 'sendonly';
    });
  }
  // create an answer to an offer
  yourConn.createAnswer().then(function(answer) {
    yourConn.setLocalDescription(answer);

    send({type: 'answer', answer: answer});
  })
};

// when we got an answer from a remote user
function handleAnswer(answer) {
  yourConn.setRemoteDescription(new RTCSessionDescription(answer));
};

// when we got an ice candidate from a remote user
function handleCandidate(candidate) {
  yourConn.addIceCandidate(new RTCIceCandidate(candidate));
};

function handleLeave() {
  connectedUser = null;
  video.srcObject = null;

  // yourConn.close();
  yourConn.onicecandidate = null;
  // yourConn.ontrack = null;
};

hangUpBtn.addEventListener('click', function() {
  send({type: 'leave'});
  handleLeave();
});
