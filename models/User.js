const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;
const md5 = require('md5');
const validator = require('validator');
const mongodbErrorHandler = require('mongoose-mongodb-errors');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new Schema({
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    // validator is a cool node validation library with methods for checking stuff like emails
    validate: [validator.isEmail, 'Invalid Email Address'],
    required: 'Please supply an email address'
  },
  name: {
    type: String,
    required: 'Please supply a name',
    trim: true
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  hearts: [
    { type: mongoose.Schema.ObjectId, ref: 'Store' }
  ]
});

// virtual field, doesn't need to be saved in the database, can be calculated for each record
userSchema.virtual('gravatar').get(function () {
  const hash = md5(this.email);
  return `https://gravatar.com/avatar/${hash}?s=200`;
});

// passport handles password hashing, redirects, password resets, and login stuff
// it makes some methods available on the User model and also adds a user object to the request
userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });
// this makes the validation errors that mongo returns easier to understand by humans
userSchema.plugin(mongodbErrorHandler)

module.exports = mongoose.model('User', userSchema);