var express = require('express');
var router = express.Router();
var path = require('path');
var _ = require('lodash');

var apiKey = process.env.TOKBOX_API_KEY;
var secret = process.env.TOKBOX_SECRET;

if (!apiKey || !secret) {
  console.error('=========================================================================================================');
  console.error('');
  console.error('Missing TOKBOX_API_KEY or TOKBOX_SECRET');
  console.error('Find the appropriate values for these by logging into your TokBox Dashboard at: https://tokbox.com/account/#/');
  console.error('Then add them to ', path.resolve('.env'), 'or as environment variables' );
  console.error('');
  console.error('=========================================================================================================');
  process.exit();
}

var OpenTok = require('opentok');
var opentok = new OpenTok(apiKey, secret);

// IMPORTANT: roomToSessionIdDictionary is a variable that associates room names with unique
// unique sesssion IDs. However, since this is stored in memory, restarting your server will
// reset these values if you want to have a room-to-session association in your production
// application you should consider a more persistent storage

var roomToSessionIdDictionary = {};

// returns the room name, given a session ID that was associated with it
function findRoomFromSessionId(sessionId) {
  return _.findKey(roomToSessionIdDictionary, function (value) { return value === sessionId; });
}

//TOKBOX

router.get('/', function (req, res) {
  res.render('index', { title: 'Learning-OpenTok-Node' });
});


var currentId = "";
/**
 * GET /session
 */
router.get('/tokbox/create', function (req, res) {
  opentok.createSession({ mediaMode: 'routed' }, function (err, session) {
      if (err) {
        console.log(err);
        res.status(500).send({ error: 'createSession error:' + err });
        return;
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.send({callId: session.sessionId});
        currentId = session.sessionId;
      }
    });
})

router.get('/tokbox/current', function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.send({callId: currentId});
});

router.get('/tokbox/join/:sessionId/:username', function(req, res) {
  var sessionId = req.params.sessionId;
  var username = req.params.username;
  
  //Generate token
  var tokenOptions = {};
  tokenOptions.role = "moderator";
  tokenOptions.data = "username=" + username;
  
  var token = opentok.generateToken(sessionId, tokenOptions);
  
  //Send response
  res.setHeader('Content-Type', 'application/json');
    res.send({
      apiKey: apiKey,
      callId: sessionId,
      token: token
    });
});

/**
 * GET /room/:name/:username - Non-vaas demo
 */
router.get('/room/:name/:username', function (req, res) {
  var roomName = req.params.name;
  var username = req.params.username;
  var sessionId;
  var token;
  console.log('attempting to create a session associated with the room: ' + roomName);

  // if the room name is associated with a session ID, fetch that
  if (roomToSessionIdDictionary[roomName]) {
    sessionId = roomToSessionIdDictionary[roomName];

    var tokenOptions = {};
    tokenOptions.role = "moderator";
    tokenOptions.data = "username=" + username;

    // Generate a token.
    token = opentok.generateToken(sessionId, tokenOptions);
    
    res.setHeader('Content-Type', 'application/json');
    res.send({
      apiKey: apiKey,
      sessionId: sessionId,
      token: token
    });
  }
  // if this is the first time the room is being accessed, create a new session ID
  else {
    opentok.createSession({ mediaMode: 'routed' }, function (err, session) {
      if (err) {
        console.log(err);
        res.status(500).send({ error: 'createSession error:' + err });
        return;
      }

      // now that the room name has a session associated wit it, store it in memory
      // IMPORTANT: Because this is stored in memory, restarting your server will reset these values
      // if you want to store a room-to-session association in your production application
      // you should use a more persistent storage for them
      roomToSessionIdDictionary[roomName] = session.sessionId;

      var tokenOptions = {};
      tokenOptions.role = "moderator";
      tokenOptions.data = "username=" + username;

      // Generate a token.
      token = opentok.generateToken(session.sessionId, tokenOptions);
      
      res.setHeader('Content-Type', 'application/json');
      res.send({
        apiKey: apiKey,
        sessionId: session.sessionId,
        token: token
      });
    });
  }
});

//TWILIO
const ACCOUNT_SID = 'AC093f191555597f7891b45d88e3e3dcec'; //YN
const API_KEY_SID = 'SK8557877fd573930f70c8ebf883d5da21'; //YN
const API_KEY_SECRET = 'RssEzpSaVzSJDwN4de0arxApD4ZMRL2a'; //YN
const AUTH_TOKEN = '51d9b33a4aeaab7575c74ec19463c1d1'; //YN

function makeid(length) {
   var result           = '';
   var characters       = '0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

const VoiceResponse = require('twilio').twiml.VoiceResponse;

router.post('/voice', function (req, res) {  
  // Use the Twilio Node.js SDK to build an XML response
  const twiml = new VoiceResponse();
  //twiml.say({ voice: 'alice' }, 'Hello World');
  const connect = twiml.connect();
  connect.room({ participantIdentity: req.body.identity }, 'channel1');
  //connect.room({ participantIdentity: 'Globalstar' + makeid(4)}, 'channel1');
  
  res.type('text/xml');
  res.send(twiml.toString());
});

//Test for vaas demo
router.post('/makeCall', function(request, response) {
  const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);

  client.calls
        .create({
           url: 'http://demo.twilio.com/docs/voice.xml',
           to: '+17402003332',
           from: 'lucas123'
         })
        .then(call => console.log(call.sid));
});

//Join for vaas demo
router.get('/twilio/join/:room/:user', function (req, res) {
  var roomName = req.params.room;
  var username = req.params.user;
  
  var AccessToken = require('twilio').jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  // Create an Access Token
  var accessToken = new AccessToken(
  ACCOUNT_SID,
  API_KEY_SID,
  API_KEY_SECRET
  );
  
  accessToken.identity = "lucas";
  
  //Grant access to Voice
  const grant = new VoiceGrant({
    outgoingApplicationSid: "AP3c1449d2ff455e07bf49645edaa8caf0",
    incomingAllow: true });
  accessToken.addGrant(grant);

  // Serialize the token as a JWT
  var jwt = accessToken.toJwt();
  console.log(jwt);
  
  res.setHeader('Content-Type', 'application/json');
      res.send({
        message: "VoicR-conference-calling",
        token: jwt
      });
});

//Join for non-vaas demo
router.get('/twilio/room/:name/:username', function (req, res) {
  var roomName = req.params.name;
  var username = req.params.username;
  
  var AccessToken = require('twilio').jwt.AccessToken;
  var VideoGrant = AccessToken.VideoGrant;

  // Create an Access Token
  var accessToken = new AccessToken(
  ACCOUNT_SID,
  API_KEY_SID,
  API_KEY_SECRET
  );

  // Set the Identity of this token
  accessToken.identity = username;

  // Grant access to Video
  var grant = new VideoGrant();
  grant.room = roomName;
  accessToken.addGrant(grant);

  // Serialize the token as a JWT
  var jwt = accessToken.toJwt();
  console.log(jwt);
  
  res.setHeader('Content-Type', 'application/json');
      res.send({
        message: "VoicR-conference-calling",
        token: jwt
      });
});

module.exports = router;
