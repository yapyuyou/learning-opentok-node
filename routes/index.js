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
  connect.room({ participantIdentity: 'Globalstar#' + makeid(4)}, 'channel1');
  
  res.type('text/xml');
  res.send(twiml.toString());
});

//Join for vaas demo
router.get('/twilio/join/:room/:user', function (req, res) {
  var roomName = req.params.room;
  var username = req.params.user;
  
  var AccessToken = require('twilio').jwt.AccessToken;
  var VideoGrant = AccessToken.VideoGrant;

  var ACCOUNT_SID = 'AC386b244e1e0d1bf0bbef7afe701caea1';
  var API_KEY_SID = 'SKc2dc2e97e8327bd4961e62f614015679';
  var API_KEY_SECRET = 'xnhlPbruPe6G2dURv6cz5kaUgsDnDk6Z';

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

//Join for non-vaas demo
router.get('/twilio/room/:name/:username', function (req, res) {
  var roomName = req.params.name;
  var username = req.params.username;
  
  var AccessToken = require('twilio').jwt.AccessToken;
  var VideoGrant = AccessToken.VideoGrant;

  var ACCOUNT_SID = 'AC386b244e1e0d1bf0bbef7afe701caea1';
  var API_KEY_SID = 'SKc2dc2e97e8327bd4961e62f614015679';
  var API_KEY_SECRET = 'xnhlPbruPe6G2dURv6cz5kaUgsDnDk6Z';

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



//UNUSED ARCHIVE FEATURES
/**
 * POST /archive/start
 */
router.post('/archive/start', function (req, res) {
  var json = req.body;
  var sessionId = json.sessionId;
  opentok.startArchive(sessionId, { name: findRoomFromSessionId(sessionId) }, function (err, archive) {
    if (err) {
      console.error('error in startArchive');
      console.error(err);
      res.status(500).send({ error: 'startArchive error:' + err });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(archive);
  });
});

/**
 * POST /archive/:archiveId/stop
 */
router.post('/archive/:archiveId/stop', function (req, res) {
  var archiveId = req.params.archiveId;
  console.log('attempting to stop archive: ' + archiveId);
  opentok.stopArchive(archiveId, function (err, archive) {
    if (err) {
      console.error('error in stopArchive');
      console.error(err);
      res.status(500).send({ error: 'stopArchive error:' + err });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(archive);
  });
});

/**
 * GET /archive/:archiveId/view
 */
router.get('/archive/:archiveId/view', function (req, res) {
  var archiveId = req.params.archiveId;
  console.log('attempting to view archive: ' + archiveId);
  opentok.getArchive(archiveId, function (err, archive) {
    if (err) {
      console.error('error in getArchive');
      console.error(err);
      res.status(500).send({ error: 'getArchive error:' + err });
      return;
    }

    if (archive.status === 'available') {
      res.redirect(archive.url);
    } else {
      res.render('view', { title: 'Archiving Pending' });
    }
  });
});

/**
 * GET /archive/:archiveId
 */
router.get('/archive/:archiveId', function (req, res) {
  var archiveId = req.params.archiveId;

  // fetch archive
  console.log('attempting to fetch archive: ' + archiveId);
  opentok.getArchive(archiveId, function (err, archive) {
    if (err) {
      console.error('error in getArchive');
      console.error(err);
      res.status(500).send({ error: 'getArchive error:' + err });
      return;
    }

    // extract as a JSON object
    res.setHeader('Content-Type', 'application/json');
    res.send(archive);
  });
});

/**
 * GET /archive
 */
router.get('/archive', function (req, res) {
  var options = {};
  if (req.query.count) {
    options.count = req.query.count;
  }
  if (req.query.offset) {
    options.offset = req.query.offset;
  }

  // list archives
  console.log('attempting to list archives');
  opentok.listArchives(options, function (err, archives) {
    if (err) {
      console.error('error in listArchives');
      console.error(err);
      res.status(500).send({ error: 'infoArchive error:' + err });
      return;
    }

    // extract as a JSON object
    res.setHeader('Content-Type', 'application/json');
    res.send(archives);
  });
});

module.exports = router;
