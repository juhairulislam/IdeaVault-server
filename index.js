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


const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)


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

  const { authorization } = req.headers

  // console.log(req.headers , "from verify token")

  const token = authorization?.split(" ");
  // console.log(token)


  if (!token) {
    return res.status(401).json({ message: "Unauthorize" })
  }


  try {
    const JWKS = createRemoteJWKSet(
      new URL('http://localhost:3000/api/auth/jwks')
    )
    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;


    next();


  } catch (error) {
    console.error('Token validation failed:', error);
    return res.status(401).json({ message: "Unauthorize" })

  }

}

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

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

    // dynamic ideas from Id
    app.get('/ideas/:ideasId', logger, verifyToken, async (req, res) => {

      const { ideasId } = req.params;
      const query = { _id: new ObjectId(ideasId) }
      const result = await ideasCollection.findOne(query);
      res.send(result)
    })


    // trending section API

    app.get('/trending', async (req, res) => {

      const cursor = ideasCollection.find().limit(6);
      const result = await cursor.toArray();
      res.send(result)
    })


    // ==========================================
    // COMMENTS ENDPOINTS (CRUD HIERARCHY)
    // ==========================================

    // 1. Get all comments for a specific idea (Public Route)
    app.get('/comments/:ideaId', async (req, res) => {
      try {
        const { ideaId } = req.params;
        const query = { ideaId: ideaId };
        
        // Sorts comments by newest first (-1)
        const cursor = commentsCollection.find(query).sort({ createdAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch comments" });
      }
    });

    // 2. Add a new comment (Protected Route)
    app.post('/comments', verifyToken, async (req, res) => {
      try {
        const { ideaId, commentText } = req.body;
        
        // Extract user identity safely from token payload
        const newComment = {
          ideaId,
          commentText,
          userName: req.user?.name || "Anonymous Innovator",
          userEmail: req.user?.email,
          userPhoto: req.user?.picture || req.user?.image || "",
          createdAt: new Date()
        };

        const result = await commentsCollection.insertOne(newComment);
        res.status(201).json({ ...newComment, _id: result.insertedId });
      } catch (error) {
        res.status(500).json({ message: "Failed to add comment" });
      }
    });

    // 3. Edit an existing comment (Protected Route)
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

        // Security check: Match user email with comment owner
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

    // 4. Delete a comment (Protected Route)
    app.delete('/comments/:commentId', verifyToken, async (req, res) => {
      try {
        const { commentId } = req.params;
        const userEmail = req.user?.email;

        const query = { _id: new ObjectId(commentId) };
        const existingComment = await commentsCollection.findOne(query);

        if (!existingComment) {
          return res.status(404).json({ message: "Comment not found" });
        }

        // Security check: Match user email with comment owner
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
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Hello Juhair bhai!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})