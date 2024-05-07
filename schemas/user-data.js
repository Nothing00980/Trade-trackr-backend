var mongoose = require('mongoose');
const userschema = new mongoose.Schema({
    username: {type:String,require:true},
    email : {type:String,unique:true,require:true},
    password : {type:String,require:true}
})

module.exports = mongoose.model('user-data',userschema);