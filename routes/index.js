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
const ACCOUNT_SID = process.env.TWILIO_ACC_SID; //YN
const API_KEY_SID = process.env.TWILIO_API_KEY; //YN
const API_KEY_SECRET = process.env.TWILIO_KEY_SECRET; //YN
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN; //YN
const APP_SID = process.env.TWILIO_APP_SID;

function makeid(length) {
   var result           = '';
   var characters       = '0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

//For vaas demo dial-in <- THIS IS THE IMPORTANT ONE
const VoiceResponse = require('twilio').twiml.VoiceResponse;

var participants = {};

router.post('/conference', function (req, res) {  
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  dial.conference('Globalstar');
  
  res.type('text/xml');
  res.send(twiml.toString());
});

router.post('/voice', function (req, res) {  
  const twiml = new VoiceResponse();
  const connect = twiml.connect();

  try {
    var user = JSON.parse(req.body.identity);
  
    connect.room({ participantIdentity: user.username }, 'Globalstar');
    participants[user.username] = user; //Set in dictionary
  } catch (err) {
    var globalstar = "Globalstar#" + makeid(4);
    //var avtr = makeid(1);
    
    connect.room({ participantIdentity: globalstar }, 'Globalstar');
    //participants[globalstar] = JSON.parse('{"username": "'+ globalstar +'", "avatar":"' + avtr + '"}'); //Set in dictionary
  }
  
  res.type('text/xml');
  res.send(twiml.toString());
});

//Presence check for vaas demo
router.get('/twilio/participants', function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.send(Object.values(participants));
  });

//Notify when leaving for vaas demo
router.get('/twilio/leave/:username', function (req, res) {
  var username = req.params.username;
  delete participants[username];
  res.send({message: "OK"});
});

router.post('/twilio/join', function (req, res) {
  var user = JSON.parse(req.body.identity);
  participants[user.username] = user; //Set in dictionary
  res.send({message: "OK"});
});

//Get token for vaas demo
router.get('/twilio/token', function (req, res) {  
  var AccessToken = require('twilio').jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  var accessToken = new AccessToken(
  ACCOUNT_SID,
  API_KEY_SID,
  API_KEY_SECRET
  );
    
  //Grant access to Voice
  const grant = new VoiceGrant({
    outgoingApplicationSid: APP_SID,
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

//for non-vaas demo
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
