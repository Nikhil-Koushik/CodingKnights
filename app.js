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

const MemoryStore = require('memorystore')(session)

app.use(session({
    cookie: { maxAge: 60000 },
    store: new MemoryStore({
      checkPeriod: 60000 // prune expired entries every 24h
    }),
    resave: false,
    saveUninitialized: true,
    secret: process.env.SECRET
}))

app.use(passport.initialize());
app.use(passport.session());
mongoose.connect(process.env.MONGO,{useNewUrlParser:true,useUnifiedTopology:true});
// mongoose.connect("",{useNewUrlParser:true,useUnifiedTopology:true});

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String
})

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User",userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user.id);
  });
});

passport.deserializeUser(function(id, cb) {
  User.findById(id)
  .then(function(user)
    {
      return cb(null, user);
    })
  .catch(function(err)
    {
      return cb(err);
    })

});


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
}

const Batch = mongoose.model("Batch",batchSchema);

app.get("/",function(req,res){
  res.render("login",{msg:""});
})

app.get("/"+process.env.REGISTER,function(req,res){
  res.render("register");
})
app.post("/"+process.env.REGISTER,function(req,res){
  User.register({username: req.body.username},req.body.password,function(err,user){
    if (err){
      res.redirect("/registerNikhilRightNow");
    } else {
      passport.authenticate("local")(req,res,function(){
        res.redirect("/home");
      });
    }
  });
})
app.get("/home",function(req,res){
  if (req.isAuthenticated()){
    res.render("home",{un:req.user.username});
  } else {
    res.redirect("/login");
  }
});
app.get("/login",function(req,res){
  if (req.isAuthenticated()){
    res.render("home",{un:req.user.username});
  } else {
    res.render("login",{msg:""});
  }
});

app.post('/login',
  passport.authenticate('local', { successRedirect: '/home', failWithError: true }),
  function(err, req, res, next) {
    return res.render('login',{msg:"Invalid User"});
  }
);

app.get("/beginner",function(req,res){
  Batch.find().then(function(batches){
    batches.forEach((item, i) => {
      res.render("beginner",{un:req.user.username,arr:item.batchArray});
    });
    }).catch(function(err){console.log(err);});
  });


app.get("/beginner/:batch",function(req,res){
  Batch.find().then(function(batches){
    batches.forEach((item, i) => {
      const data = item.batchArray;
      data.forEach((batch, i) => {
        if (batch.batchGetter === req.params.batch){
          res.render("batches",{un:req.user.username,data:batch})
        }
      });
    });
  }).catch(function(err){console.log(err);});
});

app.get("/beginner/:batch/:day",function(req,res){
  Batch.find().then(function(batches){
    batches.forEach((item, i) => {
      const data = item.batchArray;
      data.forEach((batch, i) => {
        if (batch.batchGetter === req.params.batch){
          batch.batchDays.dates.forEach((specificDate, i) => {
            if (specificDate.date === req.params.day){
              res.render("days",{un:req.user.username,batch:req.params.batch,day:req.params.day,data:specificDate})
            }
          });

        }
      });

    });

  }).catch(function(err){console.log(err);});
});
app.post("/beginner/:batch/:day",function(req,res){
  const cmnt = {User:req.user.username,Comment: req.body.comment};
  Batch.find().then(function(batches){
    batches.forEach((item, i) => {
      const data = item.batchArray;
      data.forEach((batch, j) => {
        if (batch.batchGetter === req.params.batch){
          batch.batchDays.dates.forEach((specificDate, k) => {
            if (specificDate.date === req.params.day){
              batches[i].batchArray[j].batchDays.dates[k].comments.push(cmnt);
              batches[i].save();
              res.redirect("/beginner/"+req.params.batch+"/"+req.params.day);

            }
          });

        }
      });

    });

  }).catch(function(err){console.log(err);});
  // Batch.findOne({batchGetter: req.params.batch}).then(
  //   function(foundList){
  //     foundList.batchDays.dates.forEach((item, i) => {
  //       if (item.date === req.params.day){
  //         // console.log(req);
  //         foundList.batchDays.dates[i].comments.push({"User":req.user.username,"Comment":cmnt});
  //         foundList.save();
  //         res.redirect("/beginner/"+req.params.batch+"/"+req.params.day);
  //       }
  //     });
  //   }
  // ).catch(function(err){console.log(err);});
});
app.get("/logout",function(req,res){
  req.logout(function(err){
    console.log(err);
  });
  res.redirect("/");
});

app.get("/aboutUs",function(req,res){
  res.render("aboutUs",{un:req.user.username});
})

app.get("/contactUs",function(req,res){
  res.render("contactUs",{un:req.user.username});
})

app.get("/beginner/:batch/:day/zoom/:zoom",function(req,res){
  res.status(301).redirect("https://us05web.zoom.us/j/"+req.params.zoom);
})
app.get("/beginner/:batch/:day/doc/:doc",function(req,res){
  res.status(301).redirect("https://drive.google.com/file/d/"+req.params.doc+"/view?usp=sharing/");
})



app.listen(3000);




// const l = ['Batch-1'];
// l.forEach((item) => {
//   const batch = new Batch({
//     batchName: item,
//     batchGetter: _.lowerFirst(item),
//     batchDays: {
//     dates: [
//       {
//         "date" : "Day-1",
//           "title" : "Walking through",
//           "content" : "Teaching",
//           "zoom": "",
//           "doc":"",
//           "comments" : [
//               "Miami",
//               "Jhonas"
//             ]
//       }
//     ]
//     }
//   });
//   batch.save();
// });
