const mongoose = require('mongoose');
const User = mongoose.model('User');
const Store = mongoose.model('Store');
const promisify = require('es6-promisify');

exports.loginForm = (req, res) => {
  res.render('login', { title: 'Login' });
};

exports.registerForm = (req, res) => {
  res.render('register', { title: 'Register', body: req.body });
};

exports.validateRegister = (req, res, next) => {
  req.sanitizeBody('name');
  req.checkBody('name', 'You must supply a name').notEmpty();
  req.checkBody('email', 'That email is not valid').isEmail();
  req.sanitizeBody('email').normalizeEmail({
    remove_dots: false,
    remove_extension: false,
    gmail_remove_subaddress: false
  });
  req.checkBody('password', 'Password cannot be blank').notEmpty();
  req.checkBody('password-confirm', 'Confirmed password cannot be blank').notEmpty();
  req.checkBody('password-confirm', 'Oops! Your passwords do not match').equals(req.body.password);

  const errors = req.validationErrors();
  if (errors) {
    req.flash('error', errors.map(err => err.msg));
    res.render('register', { title: 'Register', body: req.body, flashes: req.flash() });
    return; // stop the function from running
  }
  // pass to .register()
  next();
};

exports.register = async (req, res, next) => {
  const user = await (new User({ email: req.body.email, name: req.body.name }));
  // promisify the register method from passport
  const register = promisify(User.register, User); 
  // hash the password
  await register(user, req.body.password);
  // pass to authController.login()
  next();
};

exports.account = (req, res) => {
  res.render('account', { title: 'Edit your account' });
};

exports.updateAccount = async (req, res) => {
  const updates = {
    name: req.body.name,
    email: req.body.email
  };

  const user = await User.findOneAndUpdate(
    { _id: req.user._id }, 
    { $set: updates }, // $set operation replaces the value(s) of specific fields with specified data. I think otherwise it just updates every field.
    { new: true, runValidators: true, context: 'query' }
  );
  req.flash('success', 'Updated your account');
  res.redirect('back');
};

exports.getHearts = async (req, res) => {
  // mongo operator $in looks in an array for a key
  const stores = await Store.find({ _id: { $in: req.user.hearts }});
  res.render('stores', { title: 'Hearted Stores', stores });
};