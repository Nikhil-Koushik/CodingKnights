// jshint esversion:6
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const _ = require("lodash");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

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
passport.deserializeUser(async (id, cb) => {
  try {
    const user = await User.findById(id);
    cb(null, user);
  } catch (err) {
    cb(err);
  }
});

const batchSchema = new mongoose.Schema({
  batchArray: [
    {
      batchName: String,
      batchGetter: String,
      batchDays: {
        dates: [
          {
            date: String,
            title: String,
            content: String,
            zoom: String,
            doc: String,
            comments: [{ User: String, Comment: String }]
          }
        ]
      }
    }
  ]
});

const Batch = mongoose.model("Batch", batchSchema);

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

app.get("/", (req, res) => {
  res.render("login", { msg: "" });
});

app.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/home");
  }
  res.render("login", { msg: "" });
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/home",
    failureRedirect: "/login",
    failureMessage: true
  })
);

app.get("/logout", (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect("/");
  });
});

app.get("/" + process.env.REGISTER, (req, res) => {
  res.render("register");
});

app.post("/" + process.env.REGISTER, async (req, res) => {
  try {
    const user = await User.register(
      { username: req.body.username },
      req.body.password
    );
    req.login(user, err => {
      if (err) return res.redirect("/login");
      res.redirect("/home");
    });
  } catch (err) {
    res.redirect("/" + process.env.REGISTER);
  }
});

app.get("/home", ensureAuth, (req, res) => {
  res.render("home", { un: req.user.username });
});

app.get("/beginner", ensureAuth, async (req, res) => {
  const batchDoc = await Batch.findOne();
  if (!batchDoc) return res.status(404).send("No batches found");

  res.render("beginner", {
    un: req.user.username,
    arr: batchDoc.batchArray
  });
});

app.get("/beginner/:batch", ensureAuth, async (req, res) => {
  const batchDoc = await Batch.findOne({
    "batchArray.batchGetter": req.params.batch
  });

  if (!batchDoc) return res.status(404).send("Batch not found");

  const batch = batchDoc.batchArray.find(
    b => b.batchGetter === req.params.batch
  );

  res.render("batches", {
    un: req.user.username,
    data: batch
  });
});

app.get("/beginner/:batch/:day", ensureAuth, async (req, res) => {
  const batchDoc = await Batch.findOne({
    "batchArray.batchGetter": req.params.batch
  });

  if (!batchDoc) return res.status(404).send("Batch not found");

  const batch = batchDoc.batchArray.find(
    b => b.batchGetter === req.params.batch
  );

  const day = batch.batchDays.dates.find(
    d => d.date === req.params.day
  );

  if (!day) return res.status(404).send("Day not found");

  res.render("days", {
    un: req.user.username,
    batch: req.params.batch,
    day: req.params.day,
    data: day
  });
});

app.post("/beginner/:batch/:day", ensureAuth, async (req, res) => {
  const comment = {
    User: req.user.username,
    Comment: req.body.comment
  };

  const batchDoc = await Batch.findOne({
    "batchArray.batchGetter": req.params.batch
  });

  if (!batchDoc) return res.status(404).send("Batch not found");

  const batch = batchDoc.batchArray.find(
    b => b.batchGetter === req.params.batch
  );

  const day = batch.batchDays.dates.find(
    d => d.date === req.params.day
  );

  if (!day) return res.status(404).send("Day not found");

  day.comments.push(comment);
  await batchDoc.save();

  res.redirect(`/beginner/${req.params.batch}/${req.params.day}`);
});

app.get("/aboutUs", ensureAuth, (req, res) => {
  res.render("aboutUs", { un: req.user.username });
});

app.get("/contactUs", ensureAuth, (req, res) => {
  res.render("contactUs", { un: req.user.username });
});

app.get("/beginner/:batch/:day/zoom/:zoom", ensureAuth, (req, res) => {
  res.redirect(`https://us05web.zoom.us/j/${req.params.zoom}`);
});

app.get("/beginner/:batch/:day/doc/:doc", ensureAuth, (req, res) => {
  res.redirect(
    `https://drive.google.com/file/d/${req.params.doc}/view?usp=sharing`
  );
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
