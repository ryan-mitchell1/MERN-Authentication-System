const mongoose = require("mongoose");

mongoose
  .connect("mongodb://localhost:27017/resume2", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    family: 4,
  })
  .then((db) => console.log("DB is connected"))
  .catch((err) => console.log(err));
