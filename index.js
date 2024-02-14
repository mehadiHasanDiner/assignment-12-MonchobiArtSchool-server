const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

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

    const enrolledCollection = client
      .db("monchobiSchoolDB")
      .collection("enrolled");

    // classes database
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // enrollments database in the monchobi art class
    app.post("/enrolled/:enrolledId", async (req, res) => {
      const classId = req.params.enrolledId;
      // find class id
      const enrolledClass = await classesCollection.findOne({
        _id: new ObjectId(classId),
      });
      if (!enrolledClass) {
        return res
          .status(404)
          .send({ error: true, message: "Class not found" });
      }
      // check if class already exists
      if (enrolledClass.availableSeat > 0) {
        await classesCollection.updateOne(
          { _id: new ObjectId(classId) },
          { $inc: { availableSeat: -1 } }
        );

        // save enrolled class
        await enrolledCollection.insertOne({
          classId: new ObjectId(classId),
          enrollmentDate: new Date(),
        });
        return res
          .status(200)
          .send({ error: false, message: "Enrollment successful" });
      } else {
        return res
          .status(400)
          .send({ error: true, message: "No seats available" });
      }
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
