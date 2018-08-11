const passport = require('passport');
const mongoose = require('mongoose');
const User = mongoose.model('User');

// all three of these methods on User come from the passport plugin in User.js
passport.use(User.createStrategy());

// this determines which data should be stored in the session
// available on the request as req.session.passport.user.
// Usually that data is a unique field from the user object, like id
passport.serializeUser(User.serializeUser());

// the key passed to serializeUser is used to fetch the whole user object
// from the database and attach it to the request as req.user
// see: https://stackoverflow.com/questions/27637609/understanding-passport-serialize-deserialize
passport.deserializeUser(User.deserializeUser());
