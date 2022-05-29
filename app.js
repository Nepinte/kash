//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const https = require("https");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const cors = require("cors");


const homeStartingContent = "";

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {
  useNewUrlParser: true
});


// "mongodb+srv://admin-kash:123Sarmila098@cluster0.g9es6.mongodb.net/userDB"
// app.use(bodyParser.json({ limit: "30mb", extender: true }));
// app.use(bodyParser.urlencoded({ limit: "30mb", extender: true }));
// app.use(cors());
// const CONNECTION_URL =
//   "mongodb+srv://admin-kash:123Sarmila098@cluster0.g9es6.mongodb.net/userDB";
// const PORT = process.env.PORT || 3000;
// mongoose
//   .connect(CONNECTION_URL, {
//     useNewUrlParser: true,
//     useCreateIndex: true,
//   })
//   .then(() =>
//     app.listen(PORT, () => console.log(`server running on port: ${PORT}`))
//   )
//   .catch((error) => console.log(error.message));
// mongoose.set(("useCreateIndex", false));


const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res) {
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', {
    scope: ["profile"]
  })
);

app.get("/auth/google/secrets",
  passport.authenticate('google', {
    failureRedirect: "/login"
  }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  });

app.get("/login", function(req, res) {
  res.render("login");
});


app.get("/register", function(req, res) {
  res.render("register");
});


// SECRETS //
app.get("/secrets", function(req, res) {
  User.find({
    "secret": {
      $ne: null
    }
  }, function(err, foundUsers) {
    if (err) {
      console.log(err);
    } else {
      if (foundUsers) {
        res.render("secrets", {
          usersWithSecrets: foundUsers
        });
      }
    }
  });
});

// SUBMIT //
app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});
app.post("/submit", function(req, res) {
  const submittedSecret = req.body.secret;
  User.findById(req.user.id, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(function() {
          res.redirect("/secrets");
        });
      }
    }
  });
});

// LOGOUT //
app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

// REGISTER //
app.post("/register", function(req, res) {
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });
});


//LOGIN //
app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });
});

//POST//
const postSchema = {
  title: String,
  content: String,
};
const Post = mongoose.model("Post", postSchema);
app.get("/story", function(req, res) {
  Post.find({}, function(err, posts) {
    res.render("story", {
      startingContent: homeStartingContent,
      posts: posts
    });
  });
});

app.get("/compose", function(req, res) {
  res.render("compose");
});
app.post("/compose", function(req, res) {
  const post = new Post({
    title: req.body.postTitle,
    content: req.body.postBody,
  });
  post.save(function(err) {
    if (!err) {
      res.redirect("/story");
    }
  });
});
app.get("/posts/:postId", function(req, res){
const requestedPostId = req.params.postId;
  Post.findOne({_id: requestedPostId}, function(err, post){
    res.render("post", {
      title: post.title,
      content: post.content,
    });
  });
});

// WEATHER //
app.get("/weather", function(req, res) {
  res.render("weather");
});

app.post("/weather", function(req, res) {
  const query = req.body.cityName;
  const apiKey = "d6ecf26d7bb501f917d55f58d2fecc3a"
  const unit = "Imperial"
  const url = "https://api.openweathermap.org/data/2.5/weather?q=" + query + "&appid=" + apiKey + "&units=" + unit;

  https.get(url, function(response) {
    console.log(response.statusCode);

    response.on("data", function(data) {
      const weatherData = JSON.parse(data);
      const temp = weatherData.main.temp;
      const weatherDescription = weatherData.weather[0].description;
      const icon = weatherData.weather[0].icon;
      const imageURL = "https://openweathermap.org/img/wn/" + icon + "@2x.png";

      res.write("<p>The weather is currently " + weatherDescription + "<p>");
      res.write("<h1>The temperature in " + query + " is " + temp + " Degree Fahrenheit </h1>");
      res.write("<img src=" + imageURL + ">");
      res.send();
    });
  });
});

let port = process.env.PORT;
if(port == null || port == ""){
  port = 8080;
}
app.listen(port);

app.listen(port, function() {
  console.log("Server has started Successful.");
});
