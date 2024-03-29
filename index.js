const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// verification jwt token
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer  token
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

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
    client.connect();

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const users = await usersCollection.findOne(query);
      if (users?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const users = await usersCollection.findOne(query);
      if (users?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    const classesCollection = client
      .db("monchobiSchoolDB")
      .collection("classes");

    const selectedCollection = client
      .db("monchobiSchoolDB")
      .collection("selected");

    const usersCollection = client.db("monchobiSchoolDB").collection("users");

    const newClassesCollection = client
      .db("monchobiSchoolDB")
      .collection("newClasses");

    const paymentsCollection = client
      .db("monchobiSchoolDB")
      .collection("payments");

    const approvedClassCollection = client
      .db("monchobiSchoolDB")
      .collection("approvedClass");

    const deniedClassCollection = client
      .db("monchobiSchoolDB")
      .collection("deniedClass");

    // post created jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

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
      const selectedClass = await approvedClassCollection.findOne(query);
      if (!selectedClass) {
        // return res
        //   .status(404)
        //   .send({ error: true, message: "Class not found" });
        res.send([]);
      }
      // check if class already exists
      if (selectedClass.availableSeat > 0) {
        await approvedClassCollection.updateOne(query, {
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
      // [for accessing classes route every time that's why it is open]
      // const decodedEmail = req.decoded.email;
      // if (email !== decodedEmail) {
      //   return res
      //     .status(400)
      //     .send({ error: true, message: "forbidden access" });
      // }

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

    // save user email and role (admin, instructor) in DB [3 in 1, in one api call]
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      // user.createAt = new Date();
      // console.log(user);
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      // console.log(result);
      res.send(result);
    });

    // get user and his role
    app.get("/users/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // get all users data
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await usersCollection.find().toArray();
      // .sort({ createAt: -1 })
      res.send(result);
    });

    // post new class data to the new class collection
    app.post("/newClass", verifyJWT, verifyInstructor, async (req, res) => {
      const content = req.body;
      content.createAt = new Date();
      const result = await newClassesCollection.insertOne(content);
      // console.log(result);
      res.send(result);
    });

    // get all classes data posted by instructor
    app.get("/allClasses", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await newClassesCollection
        .find()
        .sort({ createAt: -1 })
        .toArray();
      res.send(result);
    });

    // get posted class data based on email address
    app.get("/allClasses/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(400)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const result = await newClassesCollection.find(query).toArray();
      res.send(result);
    });

    // update pending, approved, denied status data
    app.put("/allClasses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const { status } = req.body;

      const updatedResult = await newClassesCollection.updateOne(query, {
        $set: { status },
      });

      if (updatedResult.modifiedCount === 1) {
        if (status === "Approved") {
          const updatedData = await newClassesCollection.findOne(query);
          await approvedClassCollection.insertOne(updatedData);
        } else if (status === "Denied") {
          const updatedData = await newClassesCollection.findOne(query);
          await deniedClassCollection.insertOne(updatedData);
        }
      }
      res.send(updatedResult);
    });

    // get all approved class
    app.get("/approvedClass", async (req, res) => {
      const result = await approvedClassCollection
        .find()
        .sort({ createAt: -1 })
        .toArray();
      res.send(result);
    });

    // sending status feedback data
    app.put("/allClasses/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const { feedback } = req.body;
      const result = await newClassesCollection.updateOne(query, {
        $set: { feedback },
      });
      res.send(result);
    });

    // payment integration: create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { feeAmount } = req.body;
      const amount = feeAmount * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "USD",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related api calls
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentsCollection.insertOne(payment);

      // const query = {
      //   _id: { $in: payment.selectId.map((id) => new ObjectId(id)) },
      // };
      // _id: { $in: Array.isArray(payment.selectId) ? payment.selectId.map(id => new ObjectId(id)) : [] },

      const query = {
        _id: new ObjectId(payment.selectId),
      };

      const deleteResult = await selectedCollection.deleteOne(query);
      res.send({ result: insertResult, deleteResult });
    });

    // get enrollment information
    app.get("/enrollment/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (!email) {
        res.send([]);
      }

      const query = { email: email };
      const result = await paymentsCollection.find(query).toArray();
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
