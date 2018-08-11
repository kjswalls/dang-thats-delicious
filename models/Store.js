const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name!',
  },
  slug: String, 
  description: {
    type: String,
    trim: true,
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now,
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [{
      type: Number,
      required: 'You must supply coordinates',
    }],
    address: {
      type: String,
      required: 'You must supply an address',
    },
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author'
  }
}, {
  // these configuration options make virtual fields available when a Store object is passed as a JS object or as JSON
  // by default, virtuals don't show up automatically in these cases
  // they can still be accessed directly without these options though
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Define our indexes
storeSchema.index({
  name: 'text',
  description: 'text'
});

storeSchema.index({
  location: '2dsphere'
});

// if we wanted to sanitize these inputs (strip out unwanted HTML, JS) we could
// find an npm package that did that and hook it up to our inputs in another
// .pre('save') hook to strip out shit before we save to the database
storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    next(); // skip it
    return; // stop this function from running
  }
  this.slug = slug(this.name);
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  } 

  next();
  // TODO make more resilient so slugs are unique
});

// statics are methods we can define on a mongoose model
storeSchema.statics.getTagsList = function() {
  // you pass .aggregate() a 'pipeline', which is a sequence of data aggregation operations or stages
  return this.aggregate([
    // first we get all the stores for each tag
    // aka, unwinding the collection Stores by their tag field
    { $unwind: '$tags' },
    // then we group those stores by the tag field, and count the Stores in each group, incrementing by 1
    { $group: { _id: '$tags', count: { $sum: 1 } }},
    // then we sort these tag groups by their count, in descending order
    { $sort: { count: -1 }}
  ]);
};

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    // Lookup stores and populate their reviews
    // similar to virtual field below, but we can't use that cuz that's mongoose and this is pure MongoDB
    // the reason it's from: 'reviews' and not from 'Review' is because... mongo automatically does that for you
    // lowercases it and adds an 's' at the end
    { $lookup: { from: 'reviews', localField: '_id', foreignField: 'store', as: 'reviews' }},
    // filter for only items that have 2 or more reviews
    { $match: { 'reviews.1': { $exists: true } }},
    // Add the average reviews field
    // addFields is a mongo operator that adds a virtual field basically
    // it is comparable to $project except $project like replaces all fields with just the virtual by default
    // with $project, you just also specify the other existing fields that you want
    { $addFields: {
      // $ on the $reviews means that this is a field from data earlier in the pipeline
      averageRating: { $avg: '$reviews.rating' }
    }},
    // sort the stores by the new field, highest ratings first
    { $sort: { averageRating: -1 }},
    // limit to at most top 10 stores
    { $limit: 10 }
  ]);
};

// virtual fields aren't saved in the db but are calculated on request
// find reviews where store's "_id" property === the review's "store" property
storeSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id', // which field on this local model (Store)
  foreignField: 'store' // should match up with which field on the target (Review)
});

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

function autopopulate(next) {
  this.populate('reviews');
  next();
}

module.exports = mongoose.model('Store', storeSchema);