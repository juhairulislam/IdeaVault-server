const express = require('express')
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

dotenv.config()
const app = express()

app.use(cors())
app.use(express.json())
const port = process.env.PORT || 8080

const uri = process.env.MONGODB_URI

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const logger = (req, res, next) => {
  console.log(`${req.method} || ${req.url}`)
  next();
}

const verifyToken = async (req, res, next) => {
  try {
    const { authorization } = req.headers;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Unauthorized: Token missing" });
    }

    const token = authorization.split(" ");

    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
    );

    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['EdDSA']
    });

    req.user = payload;
    next();

  } catch (error) {
    console.error('Token validation failed error detail:', error.message);
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

async function run() {
  try {
    const db = client.db('ideavault');
    const ideasCollection = db.collection('ideas');
    const commentsCollection = db.collection('comments');

    app.get('/ideas', async (req, res) => {
      const { search } = req.query;
      let cursor;
      if (search) {
        cursor = ideasCollection.find({
          title: { $regex: search, $options: 'i' }
        })
      } else {
        cursor = ideasCollection.find();
      }
      const result = await cursor.toArray();
      res.send(result)
    });

    app.post('/ideas', async (req, res) => {
      const ideasData = req.body;
      const result = await ideasCollection.insertOne(ideasData);
      res.json(result);
    });

    app.get('/ideas/:ideasId', logger, verifyToken, async (req, res) => {
      const { ideasId } = req.params;
      const query = { _id: new ObjectId(ideasId) }
      const result = await ideasCollection.findOne(query);
      res.send(result)
    })

    app.get('/my-ideas', verifyToken, async (req, res) => {
      try {
        const userEmail = req.user?.email;
        const query = { "author.email": userEmail };
        const result = await ideasCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch your ideas" });
      }
    });

    app.put('/ideas/:id', verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { ...req.body, updatedAt: new Date() }
        };
        const result = await ideasCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update" });
      }
    });

    app.delete('/ideas/:id', verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };
        const result = await ideasCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete" });
      }
    });

    app.get('/trending', async (req, res) => {
      const cursor = ideasCollection.find().limit(6);
      const result = await cursor.toArray();
      res.send(result)
    })

    app.get('/comments', async (req, res) => {
      try {
        const result = await commentsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch all comments" });
      }
    });

    app.get('/comments/:ideaId', async (req, res) => {
      try {
        const { ideaId } = req.params;
        const query = { ideaId: ideaId };
        const cursor = commentsCollection.find(query).sort({ createdAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch comments" });
      }
    });

    app.post('/comments', verifyToken, async (req, res) => {
      try {
        const { ideaId, ideaTitle, commentText } = req.body;
        const newComment = {
          ideaId,
          ideaTitle,
          commentText,
          userName: req.user?.name || "Anonymous Innovator",
          userEmail: req.user?.email,
          userPhoto: req.user?.image || "",
          createdAt: new Date()
        };
        const result = await commentsCollection.insertOne(newComment);
        res.status(201).json({ ...newComment, _id: result.insertedId });
      } catch (error) {
        res.status(500).json({ message: "Failed to add comment" });
      }
    });

    app.put('/comments/:commentId', verifyToken, async (req, res) => {
      try {
        const { commentId } = req.params;
        const { commentText } = req.body;
        const userEmail = req.user?.email;

        const query = { _id: new ObjectId(commentId) };
        const existingComment = await commentsCollection.findOne(query);

        if (!existingComment) {
          return res.status(404).json({ message: "Comment not found" });
        }

        if (existingComment.userEmail !== userEmail) {
          return res.status(403).json({ message: "Forbidden: You can only edit your own comments" });
        }

        const updateDoc = {
          $set: {
            commentText: commentText,
            updatedAt: new Date()
          }
        };

        const result = await commentsCollection.updateOne(query, updateDoc);
        res.json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to update comment" });
      }
    });

    app.delete('/comments/:commentId', verifyToken, async (req, res) => {
      try {
        const { commentId } = req.params;
        const userEmail = req.user?.email;

        const query = { _id: new ObjectId(commentId) };
        const existingComment = await commentsCollection.findOne(query);

        if (!existingComment) {
          return res.status(404).json({ message: "Comment not found" });
        }

        if (existingComment.userEmail !== userEmail) {
          return res.status(403).json({ message: "Forbidden: You can only delete your own comments" });
        }

        const result = await commentsCollection.deleteOne(query);
        res.json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to delete comment" });
      }
    });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

module.exports = app;