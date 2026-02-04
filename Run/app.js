//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require('path');
const session = require("express-session");
const passport = require("passport");
const findOrCreate = require("mongoose-findorcreate");
const passportLocalMongoose = require("passport-local-mongoose");
const _ = require("lodash");

const app = express();

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, '/public')));
app.set("view engine","ejs");
app.set('trust proxy', 1);

const MemoryStore = require('memorystore')(session);

app.use(session({
    cookie: { maxAge: 60000 },
    store: new MemoryStore({
      checkPeriod: 60000
    }),
    resave: false,
    saveUninitialized: false,
    secret: process.env.SECRET
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO,{useNewUrlParser:true,useUnifiedTopology:true});


const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser((user, cb) => cb(null, user.id));

passport.deserializeUser((id, cb) => {
  User.findById(id)
    .then(user => cb(null, user))
    .catch(err => cb(err));
});


function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}


const batchSchema = {
  batchArray: [
    {
      batchName : String,
      batchGetter: String,
      batchDays: {
        dates: [
          {
            date: String,
            title: String,
            content: String,
            zoom: String,
            doc: String,
            comments: [{User:String,Comment:String}]
          }
        ]
      }
    }
  ]
};

const Batch = mongoose.model("Batch", batchSchema);


app.get("/", (req,res)=>{
  res.render("login",{msg:""});
});

app.get("/"+process.env.REGISTER, (req,res)=>{
  res.render("register");
});

app.post("/"+process.env.REGISTER, (req,res)=>{
  User.register({username: req.body.username}, req.body.password, (err,user)=>{
    if (err) return res.redirect("/registerNikhilRightNow");

    passport.authenticate("local")(req,res,()=>{
      res.redirect("/home");
    });
  });
});

app.get("/login", (req,res)=>{
  if (req.isAuthenticated()){
    return res.redirect("/home");
  }
  res.render("login",{msg:""});
});

app.post("/login",
  passport.authenticate('local', {
    successRedirect: '/home',
    failureRedirect: '/login'
  })
);

app.get("/home", isLoggedIn, (req,res)=>{
  res.render("home",{un:req.user.username});
});


app.get("/beginner", isLoggedIn, async (req,res)=>{
  try {
    const batchDoc = await Batch.findOne();
    res.render("beginner",{
      un:req.user.username,
      arr: batchDoc?.batchArray || []
    });
  } catch (err){
    console.log(err);
    res.sendStatus(500);
  }
});

app.get("/beginner/:batch", isLoggedIn, async (req,res)=>{
  try {
    const batchDoc = await Batch.findOne({
      "batchArray.batchGetter": req.params.batch
    });

    if (!batchDoc) return res.sendStatus(404);

    const batch = batchDoc.batchArray.find(
      b => b.batchGetter === req.params.batch
    );

    res.render("batches",{
      un:req.user.username,
      data: batch
    });

  } catch (err){
    console.log(err);
    res.sendStatus(500);
  }
});

app.get("/beginner/:batch/:day", isLoggedIn, async (req,res)=>{
  try {
    const batchDoc = await Batch.findOne({
      "batchArray.batchGetter": req.params.batch
    });

    if (!batchDoc) return res.sendStatus(404);

    const batch = batchDoc.batchArray.find(
      b => b.batchGetter === req.params.batch
    );

    const day = batch.batchDays.dates.find(
      d => d.date === req.params.day
    );

    if (!day) return res.sendStatus(404);

    res.render("days",{
      un:req.user.username,
      batch:req.params.batch,
      day:req.params.day,
      data: day
    });

  } catch (err){
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/beginner/:batch/:day", isLoggedIn, async (req,res)=>{
  try {
    const cmnt = {
      User:req.user.username,
      Comment:req.body.comment
    };

    const result = await Batch.updateOne(
      {
        "batchArray.batchGetter": req.params.batch,
        "batchArray.batchDays.dates.date": req.params.day
      },
      {
        $push: {
          "batchArray.$[].batchDays.dates.$[d].comments": cmnt
        }
      },
      {
        arrayFilters:[{ "d.date": req.params.day }]
      }
    );

    if (!result.modifiedCount) return res.sendStatus(404);

    res.redirect(`/beginner/${req.params.batch}/${req.params.day}`);

  } catch (err){
    console.log(err);
    res.sendStatus(500);
  }
});


app.get("/aboutUs", isLoggedIn, (req,res)=>{
  res.render("aboutUs",{un:req.user.username});
});

app.get("/contactUs", isLoggedIn, (req,res)=>{
  res.render("contactUs",{un:req.user.username});
});

app.get("/logout", (req,res,next)=>{
  req.logout(err=>{
    if (err) return next(err);
    res.redirect("/");
  });
});

app.get("/beginner/:batch/:day/zoom/:zoom", isLoggedIn, (req,res)=>{
  res.redirect("https://us05web.zoom.us/j/"+req.params.zoom);
});

app.get("/beginner/:batch/:day/doc/:doc", isLoggedIn, (req,res)=>{
  res.redirect("https://drive.google.com/file/d/"+req.params.doc+"/view?usp=sharing/");
});


app.listen(3000, ()=>{
  console.log("Server running on port 3000");
});
