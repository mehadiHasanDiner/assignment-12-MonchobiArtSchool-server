const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ehabgxd.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classesCollection = client
      .db("monchobiSchoolDB")
      .collection("classes");

    const selectedCollection = client
      .db("monchobiSchoolDB")
      .collection("selected");

    const usersCollection = client.db("monchobiSchoolDB").collection("users");

    // classes database
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // enrollments database in the monchobi art class
    app.post("/selected/:selectedId", async (req, res) => {
      const classId = req.params.selectedId;
      const query = { _id: new ObjectId(classId) };
      const classDetails = req.body;
      console.log(query);

      // find class id
      const selectedClass = await classesCollection.findOne(query);
      if (!selectedClass) {
        // return res
        //   .status(404)
        //   .send({ error: true, message: "Class not found" });
        res.send([]);
      }
      // check if class already exists
      if (selectedClass.availableSeat > 0) {
        await classesCollection.updateOne(query, {
          $inc: { availableSeat: -1 },
        });

        // save selected class
        const result = await selectedCollection.insertOne(classDetails);
        return res.status(200).send(result);
      } else {
        return res
          .status(400)
          .send({ error: true, message: "No seats available" });
      }
    });

    // get data based on email id
    app.get("/selected", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await selectedCollection.find(query).toArray();
      res.send(result);
    });

    // delete data from the enrollCollection
    app.delete("/selected/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      res.send(result);
    });

    // save user email and role in DB
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      console.log(result);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Welcome to Monchobi Art School");
});

app.listen(port, () => {
  console.log(`Art school server is running at ${port}`);
});
