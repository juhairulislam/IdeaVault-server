const express = require('express')
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const cors = require("cors")
dotenv.config()
const app = express()
app.use(cors())
const port =process.env.PORT || 8080



const uri = "mongodb+srv://ideavault:pDpxvkJJ8oC8TCOI@cluster0.f4ctco1.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const db = client.db('ideavault') ;
    const ideasCollection = db.collection('ideas') ;

    app.get('/ideas' , async(req , res) =>{

        const cursor = ideasCollection.find() ;
        const result = await cursor.toArray() ;
        res.send(result)
    })

    // dynamic ideas from Id
    app.get('/ideas/:ideasId' , async(req , res) =>{

        const {ideasId} = req.params ;
        const query = {_id: new ObjectId(ideasId)} 
        const result = await ideasCollection.findOne(query) ;
        res.send(result)


    })


    // trending section API

       app.get('/trending' , async(req , res) =>{

        const cursor = ideasCollection.find().limit(6) ;
        const result = await cursor.toArray() ;
        res.send(result)
    })




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

