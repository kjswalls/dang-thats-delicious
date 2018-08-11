const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

// multer is a library that lets you upload 'multipart' forms, which are forms where users
// can submit multiple data types. in this case, text and images
const multerOptions = {
  // store the photo in server memory while we resize it
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if (isPhoto) {
      // proceed, pass null for the error param
      next(null, true);
    } else {
      next({ message: 'That filetype isn\'t allowed'});
    }
  }
};

exports.homePage = (req, res) => {
  res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', { title: 'Add Store' });
};

// process the single photo field of the form with multer
exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
  // check if there's no new file to resize
  // once the upload function succeeds, multer adds a .file property on the request
  if (!req.file) {
    next(); //skip this
    return;
  }
  const extension = req.file.mimetype.split('/')[1];
  // generate a unique path to the photo
  req.body.photo = `${uuid.v4()}.${extension}`;
  console.log(req.body.photo);

  // now we resize
  // jimp reads the file's buffer property, which is the actual data of the image
  // stored in memory
  const photo = await jimp.read(req.file.buffer);
  // jimp returns an object with custom methods on it like resize
  await photo.resize(800, jimp.AUTO);
  // now jimp can write the resized photo to disk storage
  await photo.write(`./public/uploads/${req.body.photo}`);

  // once we have written the photo to the file system, keep going
  next();
}

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await (new Store(req.body)).save();
  req.flash('success', `Successfully created ${store.name}. Care to leave a review?`);
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = (page * limit) - limit;

  // Query the database for a list of all stores
  const storesPromise = Store
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc' });
  const countPromise = Store.count();
  const [stores, count] = await Promise.all([storesPromise, countPromise]);
  const pages = Math.ceil(count / limit);

  if (!stores.length && skip) {
    req.flash('info', `Hey! You asked for page ${page}, but that page doesn't exist. So we put you on page ${pages}.`);
    res.redirect(`/stores/page/${pages}`);
    return;
  }
  res.render('stores', { title: 'Stores', stores, page, pages, count });
};

const isOwner = (store, user) => {
  console.log(store.author)
  console.log(user._id);
  if (!store.author.equals(user._id)) {
    return false;
  }
};

exports.editStore = async (req, res) => {
  // find the store, given the ID
  const store = await Store.findOne({ _id: req.params.id });

  // confirm user is the owner of the store
  if (!isOwner(store, req.user)) {
    req.flash('error', 'You must own a store in order to edit it');
    res.redirect('/stores');
    return;
  }

  // render out the edit form
  res.render('editStore', { title: `Edit ${store.name}`, store });
};

exports.updateStore = async(req, res) => {
  // set location type to point
  req.body.location.type = 'Point';
  // find and update the store
  const store = await Store.findOneAndUpdate({ _id: req.params.id}, req.body, {
    new: true, // return the updated store instead of the original store
    runValidators: true, // default is to not run schema validation when updating
  }).exec();

  // redirect them to the store edit screen and tell them it worked
  req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="/stores/${store.slug}">View store</a>`);
  res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res) => {
  // query the database for the store that was requested
  const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');
  if (!store) return next();
  // pass the store data to the view
  res.render('store', { title: store.name, store });
};

exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag;
  // if there's no tag, just get all tags that exist
  const tagQuery = tag || { $exists: true };

  const tagPromise = Store.getTagsList();
  // find tags that match the tagQuery
  const storePromise = Store.find({ tags: tagQuery });
  // find stores and tags at the same time, wait for both to finish
  const [tags, stores] = await Promise.all([tagPromise, storePromise]);
  res.render('tags', { tags, stores, title: 'Tags', tag });
};

exports.searchStores = async (req, res) => {
  const stores = await Store.find({
    // $text searches the compound text index we created in the Store model
    $text: {
      // the search for the text index is the query input by the user
      $search: req.query.q
    }
  }, {
    // this second argument to Store.find() is a 'projection', aka 'fields to add'.
    // so here we're adding a 'score' field, and using the $meta expression to set
    // the value of score. this expression checks
    // the metadata of each Store found, which includes a 'textScore', which is a value
    // based on how well the $text values for that store matches the search query. 
    // This is like a special thing in mongo for when you need to do exactly this
    score: { $meta: 'textScore' }
  })
  // then sort results BY that textScore, now that it's available
  .sort({
    score: { $meta: 'textScore' }
  })
  // limit results to 5
  .limit(5);
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: 10000 // 10 kilometers
      }
    }
  };

  const stores = await Store.find(q).select('slug name description location photo').limit(10);
  if (!stores.length) {
    req.flash('error', 'No places found');
    res.redirect('/map');
    return;
  }
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render('map', { title: 'Map' });
};

exports.heartStore = async (req, res) => {
  // mongo replaces .toString method on objects returned by it, in this case ObjectIds of stores
  // remember, all properties from the User schema are placed on req.user by passportJS
  const hearts = req.user.hearts.map(obj => obj.toString());
  // set the mongoDB operator based on whether the user has already hearted this store
  // either remove a heart (pull) or add a heart (addToSet)
  // addToSet makes sure the id is unique in the array, instead of just pushing the id to the aray with $push
  const operator  = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
  const user = await User
    .findByIdAndUpdate(req.user._id,
      { [operator]: { hearts: req.params.id }},
      // return the updated user object instead of the old one
      { new: true }
    );
  res.json(user);
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  res.render('topStores', { title: 'Top Stores', stores });
};