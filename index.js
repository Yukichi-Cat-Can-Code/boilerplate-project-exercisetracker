require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true })); // parse from POSTs
app.use(express.json());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

//Database connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schema
const exerciseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  log: { type: [exerciseSchema], default: [] },
});

//Models
const User = mongoose.model("User", userSchema);

//Routes
//Create new user Post /api/users {username}
app.post("/api/users", async (req, res) => {
  try {
    const username = req.body.username;
    if (!username)
      return res.status(400).json({ error: "Username is required" });

    //If user exists, return it or create new
    let user = await User.findOne({ username }).exec();
    if (!user) {
      user = new User({ username });
      await user.save();
    }

    return res.json({ username: user.username, _id: user._id });
  } catch (err) {
    if (err.code === 11000) {
      const existing = await User.findOne({ username: req.body.username });
      return res
        .status(409)
        .json({ username: existing.username, _id: existing._id });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

//Get all users GET /api/users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "username _id").exec();
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

//Add exercise to user POST /api/users/:_id/exercises
app.post("/api/users/:_id/exercises", async (req, res) => {
  try {
    const userId = req.params._id;
    const { description, duration, date } = req.body;

    if (!description || !duration) {
      return res
        .status(400)
        .json({ error: "Description and duration are required" });
    }

    const durationNum = Number(duration);
    if (isNaN(durationNum)) {
      return res.status(400).json({ error: "Duration must be a number" });
    }

    let exerciseDate;
    if (!date) {
      exerciseDate = new Date();
    } else {
      exerciseDate = new Date(date);
    }
    if (exerciseDate.toString() === "Invalid Date") {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const exercise = {
      description: description,
      duration: durationNum,
      date: exerciseDate,
    };

    user.log.push(exercise);
    await user.save();

    return res.json({
      _id: user._id,
      username: user.username,
      date: exerciseDate,
      duration: durationNum,
      description: description,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

//Get exercise log GET /api/users/:_id/logs?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=NUMBER
app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    const { from, to, limit } = req.query;
    const userId = req.params._id;

    const user = await User.findById(userId).exec();
    if (!user) return res.json({ error: "User not found" });

    let log = user.log;

    // Apply from filter (inclusive)
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        log = log.filter((e) => e.date >= fromDate);
      }
    }

    // Apply to filter (inclusive)
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        log = log.filter((e) => e.date <= toDate);
      }
    }

    // Sort ascending by date
    log.sort((a, b) => a.date - b.date);

    // Apply limit
    let limitedLog = log;
    if (limit) {
      const lim = parseInt(limit);
      if (!isNaN(lim)) {
        limitedLog = log.slice(0, lim);
      }
    }

    // Format logs for output
    const formattedLog = limitedLog.map((ex) => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString(),
    }));

    res.json({
      username: user.username,
      _id: user._id,
      count: formattedLog.length,
      log: formattedLog,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

const listener = app.listen(process.env.PORT || 6879, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
