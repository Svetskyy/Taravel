const express = require("express");
const sqlite3 = require("sqlite3");
const bodyParser = require("body-parser");

const db = new sqlite3.Database("mydatabase.db");
const app = express();
app.use(bodyParser.json({ limit: "50mb" }));
// Serve static files from the root directory
app.use(express.static("./"));

// Optional: Default route to serve index.html
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "." });
});

app.post("/api/check", (req, res) => {
  const { sourceCoordinates, destCoordinates } = req.body;
  db.get(
    "SELECT algResults FROM genetic_data WHERE sourceCoordinates = ? AND destCoordinates = ?",
    [JSON.stringify(sourceCoordinates), JSON.stringify(destCoordinates)],
    (err, row) => {
      if (err) {
        res.status(500).send("Database error");
        return;
      }
      if (row) {
        const algResultsObject = JSON.parse(row.algResults); // Parse the string back to object
        res.json({ exists: true, algResults: algResultsObject });
      } else {
        res.json({ exists: false });
      }
    }
  );
});

app.post("/api/save-result", (req, res) => {
  const { sourceCoordinates, destCoordinates, algResults } = req.body;
  console.log(sourceCoordinates);
  db.run(
    "INSERT INTO genetic_data (sourceCoordinates, destCoordinates, algResults) VALUES (?, ?, ?)",
    [
      JSON.stringify(sourceCoordinates),
      JSON.stringify(destCoordinates),
      JSON.stringify(algResults),
    ],
    function (err) {
      if (err) {
        res.status(500).send("Error saving to database");
        return;
      }
      res.send({ message: "Data saved successfully", id: this.lastID });
    }
  );
});

app.listen(3000, () => console.log("Server running on port 3000"));
