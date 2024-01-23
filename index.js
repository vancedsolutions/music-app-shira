const express = require('express')
const bodyParser = require('body-parser')
require('./config/db');
var apis = require('./routes/apis');
require('./models/songs');
require('./models/artist');
require('./models/albums');
require('./models/tags');
require('./models/genres');


const app = express()
app.use(express.json())
app.use(bodyParser.json())

app.use('/', apis);

app.get("/api/testing", (req, res) => res.send("Passed the test!!!"));

const PORT = process.env.POST || 8080
app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`)
})