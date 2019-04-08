const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Channel = require('../models/channel');

// POST request to create a new channel, checks channel table before creation
router.post('/create', (req, res, next)=>{
    const channel = new Channel({
        _id: new mongoose.Types.ObjectId(),
        name: req.body.channelId
        });
    channel
    .save()
    .then(result=>{
        console.log(result);
    });
    res.status(200).json({
        message: "Channel created."
    });
});

// GET request to retrieve channel information
router.get('/', (req,res,next)=>{
    Channel.find()
    .exec()
    .then(doc => {
        console.log(doc);
        if (doc){
            res.status(200).json(doc);
        } else {
            res.status(404).json({message: "No valid channel name found"});
        }
    })
    .catch(err=>{
        console.log(err);
        res.status(500).json({error: err});
    });
});

router.post('/delete', (req, res, next)=>{
    var name = req.body.channelId
    Channel.deleteOne({name: name})
    .exec()
    .then(result=>
        res.status(200).json({
            message: "Channel deleted"
        }))
    .catch(err=> {
        console.log(err);
        res.status(500).json({
            error: err
        });
    });
});


module.exports = router;