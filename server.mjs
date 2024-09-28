import express from "express";
import mysql from "mysql2";

import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import multer from "multer";
import path from "path";
import fs from "fs";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = 2030;
const app = express();

app.use(express.json());
app.use(cors());

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Aravind@9989",
  database: "backend",
  port: 3306,
});

// Connect to MySQL database
connection.connect((err) => {
  if (err) {
    console.log("Error connecting to MySQL database:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Secret key for JWT
const JWT_SECRET = "kanna7266046";

// Handle POST request for /register
app.post("/register", (req, res) => {
  if (req.body) {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res
        .status(400)
        .send({ message: "Email and password are required" });
    }

    // Check if the email already exists
    const checkQuery = "SELECT * FROM userdetails WHERE email = ?";
    connection.query(checkQuery, [email], (err, results) => {
      if (err) {
        console.log("Error executing check query:", err);
        return res
          .status(500)
          .send({ message: "Error checking user existence" });
      }

      if (results.length > 0) {
        // Email already exists
        return res.status(400).send({ message: "Email already registered" });
      }

      // Hash the password
      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          console.log("Error hashing password:", err);
          return res.status(500).send({ message: "Error registering user" });
        }

        // Define the insert query
        const insertQuery =
          "INSERT INTO userdetails (email, password) VALUES (?, ?)";

        // Execute the insert query
        connection.query(
          insertQuery,
          [email, hashedPassword],
          (err, results) => {
            if (err) {
              console.log("Error executing insert query:", err);
              return res
                .status(500)
                .send({ message: "Error registering user" });
            }
            res.send({ message: "User registered successfully" });
          }
        );
      });
    });
  } else {
    res.status(400).send({ message: "Request body is empty" });
  }
});

// Handle POST request for /login
// Handle POST request for /login
app.post("/login", (req, res) => {
  if (req.body) {
    const { email, password } = req.body;
    console.log(req.body);

    // Validate inputs
    if (!email || !password) {
      return res
        .status(400)
        .send({ message: "Email and password are required" });
    }

    // Check if the email exists
    const checkQuery = "SELECT * FROM userdetails WHERE email = ?";
    connection.query(checkQuery, [email], (err, results) => {
      if (err) {
        console.log("Error executing check query:", err);
        return res
          .status(500)
          .send({ message: "Error checking user existence" });
      }

      if (results.length === 0) {
        // Email does not exist
        return res.status(401).send({
          message: "Invalid credentials. Please check your email and password.",
        });
      }

      const user = results[0];

      // Compare the password with the hashed password in the database
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.log("Error comparing passwords:", err);
          return res.status(500).send({ message: "Error logging in" });
        }

        if (!isMatch) {
          // Passwords do not match
          return res.status(401).send({
            message:
              "Invalid credentials. Please check your email and password.",
          });
        }

        // Generate a JWT token
        const token = jwt.sign({ email: user.email }, JWT_SECRET, {
          expiresIn: "1h",
        });

        res.send({ message: "Login successful", token });
      });
    });
  } else {
    res.status(400).send({ message: "Request body is empty" });
  }
});

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from 'uploads' folder
app.use("/uploads", express.static("uploads"));

// API endpoint to handle image upload and metadata saving
app.post("/upload", upload.single("image"), (req, res) => {
  const { category_name, category_sequence } = req.body;
  const image = req.file;

  if (!image) {
    return res.status(400).send("No image file uploaded.");
  }

  const imageUrl = `/uploads/${image.filename}`;
  const sql =
    "INSERT INTO category_images (category_name, category_sequence, image_url) VALUES (?, ?, ?)";

  connection.query(
    sql,
    [category_name, category_sequence, imageUrl],
    (err, result) => {
      if (err) {
        console.error("Error inserting image data:", err);
        return res.status(500).send("Failed to save image data.");
      }
      res.send({
        message: "Image uploaded and data saved successfully!",
        imageUrl,
      });
    }
  );
});

// API endpoint to fetch categories
app.get("/fetch-categories", (req, res) => {
  const sql = "SELECT * FROM category_images";

  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching categories:", err);
      return res.status(500).send("Failed to fetch categories.");
    }
    res.send(results);
  });
});

app.put("/update-category/:id", upload.single("image"), (req, res) => {
  const { id } = req.params;
  console.log(id);
  const { category_name, category_sequence, status } = req.body;
  const image = req.file;

  // Validate inputs
  if (!category_name || !category_sequence || !status) {
    return res
      .status(400)
      .send({ message: "Category name, sequence, and status are required" });
  }

  // Prepare the SQL query to update category data
  let sql =
    "UPDATE category_images SET category_name = ?, category_sequence = ?, status = ?";
  const params = [category_name, category_sequence, status];

  if (image) {
    // If there's an image file, update the image URL as well
    const imageUrl = `/uploads/${image.filename}`;
    sql += ", image_url = ?";
    params.push(imageUrl);
  }

  sql += " WHERE id = ?";
  params.push(id);

  connection.query(sql, params, (err, result) => {
    if (err) {
      console.error("Error updating category data:", err);
      return res
        .status(500)
        .send({ message: "Failed to update category data" });
    }
    res.send({ message: "Category updated successfully!" });
  });
});

app.delete("/delete-category/:id", (req, res) => {
  const categoryId = req.params.id;

  // Delete the category from the database
  const query = "DELETE FROM category_images WHERE id = ?";

  connection.query(query, [categoryId], (err, result) => {
    if (err) {
      console.error("Error deleting category:", err);
      return res.status(500).json({ error: "Failed to delete category" });
    }

    if (result.affectedRows > 0) {
      return res.status(200).json({ message: "Category deleted successfully" });
    } else {
      return res.status(404).json({ error: "Category not found" });
    }
  });
});

app.get("/fetch-categories", (req, res) => {
  const searchQuery = req.query.q ? `%${req.query.q}%` : "%%"; // Search query param if present
  const query = "SELECT * FROM category_images WHERE category_name LIKE ?";

  connection.query(query, [searchQuery], (error, results) => {
    if (error) {
      console.error("Error fetching categories:", error);
      res.status(500).send("Internal Server Error");
    } else {
      res.json(results);
    }
  });
});



// sub category

// API to fetch all sub-categories
app.get('/sub-categories', (req, res) => {
  const query = 'SELECT * FROM sub_category';
  connection.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching sub-categories:', error);
      return res.status(500).send('Internal Server Error');
    }
    res.json(results);
  });
});

// API to add a new sub-category
// app.post('/sub-categories', (req, res) => {
//   console.log("post request sub categories",req.body)
//   try {
//     const { sub_category_name, category_name, image_url, status, categorySequence } = req.body;
//     console.log(sub_category_name, category_name, image_url, status, categorySequence)
//   // Validate that required fields are provided and not null
//   if (!sub_category_name || !category_name || !sequence || !status) {
//     return res.status(400).send("All required fields must be filled.");
//   }

//   const query = `INSERT INTO sub_category 
//                  (sub_category_name, category_name, image_url, statuss, sequence) 
//                  VALUES (?, ?, ?, ?, ?)`;
//   connection.query(query, [sub_category_name, category_name, image_url, status, categorySequence], 
//     (error, results) => {
//       if     (error) {
//         console.error('Error adding sub-category:', error);
//         return res.status(500).send('Internal Server Error');
//       }
//       res.status(201).json({ message: 'Sub-category added successfully' });
//     });
//   } catch (error) {
//     console.log(error)

//   }
// });

app.post('/sub-categories', upload.single('image'), (req, res) => {
  console.log("POST request for sub-categories:", req.body);
  console.log("Uploaded file details:", req.file);

  try {
    // Extract form data
    const { sub_category_name, category_name, status, category_sequence } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate that required fields are provided
    if (!sub_category_name || !category_name || !category_sequence || !status) {
      return res.status(400).send("All required fields must be filled.");
    }

    // Insert sub-category into the database
    const query = `INSERT INTO sub_category 
                  (sub_category_name, category_name, image_url, status, sequence) 
                  VALUES (?, ?, ?, ?, ?)`;
    connection.query(query, [sub_category_name, category_name, image_url, status, category_sequence], 
      (error, results) => {
        if (error) {
          console.error('Error adding sub-category:', error);
          return res.status(500).send('Internal Server Error');
        }
        res.status(201).json({ message: 'Sub-category added successfully' });
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).send("An error occurred while adding the sub-category");
  }
});


// API to update a sub-category by ID 
app.put('/sub-categories/:id', (req, res) => {
  const { id } = req.params;
  const { sub_category_name, category_name, image_url, status, sequence } = req.body;

  // Validate that required fields are provided and not null
  if (!sub_category_name || !category_name || !sequence || !status) {
    return res.status(400).send("All required fields must be filled.");
  }

  const query = `UPDATE sub_category 
                 SET sub_category_name = ?, category_name = ?, image_url = ?, status = ?, sequence = ? 
                 WHERE id = ?`;
  connection.query(query, [sub_category_name, category_name, image_url, status, sequence, id], 
    (error, results) => {
      if (error) {
        console.error('Error updating sub-category:', error);
        return res.status(500).send('Internal Server Error');
      }
      res.json({ message: 'Sub-category updated successfully' });
    });
});

// API to delete a sub-category by ID
app.delete('/delete-sub-categories/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM sub_category WHERE id = ?';
  connection.query(query, [id], (error, results) => {
    if (error) {
      console.error('Error deleting sub-category:', error);
      return res.status(500).send('Internal Server Error');
    }
    res.json({ message: 'Sub-category deleted successfully' });
  });
});
// Backend: Ensure the route is set up like this


// Products




// Get all products
app.get("/products", (req, res) => {
  const query = "SELECT * FROM products";
  connection.query(query, (error, results) => {
    if (error) return res.status(500).json({ error });
    res.json(results);
  });
});


app.post("/products", (req, res) => {
  const { product_name, sub_category, category, status } = req.body;
  const query = "INSERT INTO products (product_name, sub_category, category, status) VALUES (?, ?, ?, ?)";
  
  connection.query(query, [product_name, sub_category, category, status], (error, results) => {
    if (error) return res.status(500).json({ error });

    const newProductId = results.insertId; 

    connection.query("SELECT * FROM products WHERE id = ?", [newProductId], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(result[0]); 
    });
  });
});

// Update a product
app.put("/products/:id", (req, res) => {
  const { id } = req.params;
  const { product_name, sub_category, category, status } = req.body;
  const query = "UPDATE products SET product_name = ?, sub_category = ?, category = ?, status = ? WHERE id = ?";

  connection.query(query, [product_name, sub_category, category, status, id], (error) => {
    if (error) return res.status(500).json({ error });

    connection.query("SELECT * FROM products WHERE id = ?", [id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(result[0]); 
    });
  });
});

// Delete a product
app.delete("/products/:id", (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM products WHERE id = ?";
  connection.query(query, [id], (error, results) => {
    if (error) return res.status(500).json({ error });
    res.json({ message: "Product deleted successfully" });
  });
});



