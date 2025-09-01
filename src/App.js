import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  where,   
  addDoc,
  orderBy,
  limit,
  getDoc,
  updateDoc,
  increment // Import the increment function for atomic updates
} from 'firebase/firestore';

// IMPORTANT: These are special global variables provided by the Canvas environment.
// We must use these for Firebase initialization to work correctly.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = {
  apiKey: "AIzaSyCepafd4ReyV2aF7fsB-k9R_uIweeDfCmU",
  authDomain: "farmtohome-fbe28.firebaseapp.com",
  projectId: "farmtohome-fbe28",
  storageBucket: "farmtohome-fbe28.firebasestorage.app",
  messagingSenderId: "973685044478",
  appId: "1:973685044478:web:cb4b6cd95dc11be21221af",
  measurementId: "G-EKY9QVTRRM"
};
const initFirebase = async () => {
  try {
    const app = initializeApp(firebaseConfig);
    const authInstance = getAuth(app);
    const dbInstance = getFirestore(app);

    // Sign in anonymously for local testing
    await signInAnonymously(authInstance);

    setDb(dbInstance);
    setAuth(authInstance);
    setIsAuthReady(true);
  } catch (error) {
    console.error("Error initializing Firebase or signing in:", error);
    setErrorMessage("Failed to connect to the database. Please check your network and try again.");
    setLoading(false);
  }
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const API_KEY = "AIzaSyBxkkJsJw55x0qS7OBCuJQLWiBmibhmtUs"; // Gemini API Key is provided at runtime

// Helper function to convert Firestore documents to objects
const docToObject = (doc) => ({
  id: doc.id,
  ...doc.data(),
});

// A simple utility to format numbers as currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

// Main App component
const App = () => {
  // State variables for the application
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [currentView, setCurrentView] = useState('products'); // 'products', 'cart', 'orders'
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: null, data: null });
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false); // New state for checkout
  const [errorMessage, setErrorMessage] = useState('');
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState('');

  // A ref to ensure the database seeding only happens once per session
  const seededRef = useRef(false);

  // 1. Initialize Firebase and authenticate the user
  useEffect(() => {
    const initFirebase = async () => {
      try {
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
          setErrorMessage("Firebase configuration is missing. Please ensure your environment is set up correctly.");
          setLoading(false);
          return; // Stop execution
        }

        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);

        // Authenticate the user. Use the custom token if available, otherwise sign in anonymously.
        await (initialAuthToken
          ? signInWithCustomToken(authInstance, initialAuthToken)
          : signInAnonymously(authInstance));

        setDb(dbInstance);
        setAuth(authInstance);
        setIsAuthReady(true);
      } catch (error) {
        console.error("Error initializing Firebase or signing in:", error);
        setErrorMessage("Failed to connect to the database. Please check your network and try again.");
        setLoading(false);
      }
    };

    initFirebase();
  }, []); // Run only once on component mount

  // 2. A separate function to handle database seeding
  const seedDatabase = async (dbInstance) => {
    try {
      const productsCollectionRef = collection(dbInstance, `/artifacts/${appId}/public/data/products`);
      const productsSnapshot = await getDocs(productsCollectionRef);

      if (productsSnapshot.empty) {
        console.log("Database is empty. Populating with initial data...");
        const initialProducts = [
          {
            name: "Organic Tomatoes",
            price: 45,
            image: "https://placehold.co/600x400/28a745/ffffff?text=Organic+Tomatoes",
            category: "Vegetables",
            description: "Freshly picked organic tomatoes from a local farm.",
            farmer: { name: "Anand Reddy", village: "Siruguppa", city: "Ballari" },
            sales_count: 120,
          },
          {
            name: "Farm-Fresh Eggs (12)",
            price: 80,
            image: "https://placehold.co/600x400/ffc107/000000?text=Farm-Fresh+Eggs",
            category: "Dairy & Poultry",
            description: "Free-range eggs from happy hens.",
            farmer: { name: "Shanthi Devi", village: "Kampli", city: "Ballari" },
            sales_count: 155,
          },
          {
            name: "Jowar Flour (1kg)",
            price: 60,
            image: "https://placehold.co/600x400/6c757d/ffffff?text=Jowar+Flour",
            category: "Grains & Pulses",
            description: "Locally ground jowar flour, perfect for rotis.",
            farmer: { name: "Ravi Kumar", village: "Hospet", city: "Ballari" },
            sales_count: 90,
          },
          {
            name: "Fresh Bell Peppers",
            price: 75,
            image: "https://placehold.co/600x400/dc3545/ffffff?text=Bell+Peppers",
            category: "Vegetables",
            description: "A colorful mix of green, red, and yellow bell peppers.",
            farmer: { name: "Prakash Gowda", village: "Siruguppa", city: "Ballari" },
            sales_count: 85,
          },
          {
            name: "Pure Honey (500g)",
            price: 250,
            image: "https://placehold.co/600x400/fd7e14/ffffff?text=Pure+Honey",
            category: "Others",
            description: "Raw, unprocessed honey from local bee farms.",
            farmer: { name: "Vijay Patil", village: "Kampli", city: "Ballari" },
            sales_count: 180,
          },
          {
            name: "Mangoes (1kg)",
            price: 120,
            image: "https://placehold.co/600x400/ffc107/000000?text=Mangoes",
            category: "Fruits",
            description: "Sweet and juicy mangoes, hand-picked from our orchards.",
            farmer: { name: "Lakshmi Sharma", village: "Hospet", city: "Ballari" },
            sales_count: 200,
          },
          {
            name: "Milk (1L)",
            price: 50,
            image: "https://placehold.co/600x400/e9ecef/000000?text=Milk",
            category: "Dairy & Poultry",
            description: "Fresh milk from our farm, delivered daily.",
            farmer: { name: "Gopal Rao", village: "Siruguppa", city: "Ballari" },
            sales_count: 145,
          },
        ];
        // Use Promise.all to ensure all documents are added before continuing
        const addDocsPromises = initialProducts.map(product => addDoc(productsCollectionRef, product));
        await Promise.all(addDocsPromises);
      }
    } catch (error) {
      console.error("Error seeding database:", error);
      throw error;
    }
  };

  // 3. Fetch initial data from Firestore after authentication is ready
  useEffect(() => {
    // Exit if Firebase is not yet ready or authenticated
    if (!db || !isAuthReady || !auth) return;

    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const uid = user.uid;
        setUserId(uid);

        // OPTIMIZATION: Seed the database ONLY once per session using the ref.
        if (!seededRef.current) {
          await seedDatabase(db);
          seededRef.current = true;
        }

        // Then, set up the real-time listeners for products and orders
        const productsCollectionRef = collection(db, `/artifacts/${appId}/public/data/products`);
        const ordersCollectionRef = collection(db, `/artifacts/${appId}/users/${uid}/orders`);

        const unsubscribeProducts = onSnapshot(productsCollectionRef, (snapshot) => {
          const fetchedProducts = snapshot.docs.map(docToObject);
          setProducts(fetchedProducts);
          const uniqueCategories = ['All', ...new Set(fetchedProducts.map(p => p.category))];
          setCategories(uniqueCategories);
        }, (error) => {
          console.error("Error fetching products:", error);
          setErrorMessage("Could not load products.");
        });

        const unsubscribeOrders = onSnapshot(ordersCollectionRef, (snapshot) => {
          const fetchedOrders = snapshot.docs.map(docToObject);
          setOrders(fetchedOrders.sort((a, b) => b.order_date.seconds - a.order_date.seconds));
        }, (error) => {
          console.error("Error fetching orders:", error);
        });

        // Set loading to false once all listeners are set up
        setLoading(false);

        // Cleanup listeners on unmount
        return () => {
          unsubscribeProducts();
          unsubscribeOrders();
        };

      } catch (error) {
        console.error("Error fetching data:", error);
        setErrorMessage("An unexpected error occurred. Please try again.");
        setLoading(false);
      }
    };

    fetchData();
  }, [db, isAuthReady, auth]); // Re-run when Firebase instances or auth state changes

  // Handle adding a product to the cart
  const addToCart = (product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
    setModal({
      isOpen: true,
      type: 'message',
      data: { message: `Added ${product.name} to cart!` }
    });
  };

  // Handle removing a product from the cart
  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  // Handle updating the quantity of a product in the cart
  const updateQuantity = (productId, newQuantity) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, quantity: Math.max(1, newQuantity) } : item
      )
    );
  };

  // Handle placing a new order
  const placeOrder = async () => {
    if (cart.length === 0 || !db || !userId) {
      setErrorMessage("Cart is empty or user not authenticated.");
      return;
    }

    setCheckoutLoading(true); // Start loading state for checkout

    try {
      const ordersCollectionRef = collection(db, `/artifacts/${appId}/users/${userId}/orders`);
      const newOrderRef = await addDoc(ordersCollectionRef, {
        customer_id: userId,
        items: cart.map(item => ({
          product_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          farmer: item.farmer
        })),
        total_amount: cart.reduce((total, item) => total + item.price * item.quantity, 0),
        status: 'Order Placed',
        payment_method: 'Cash on Delivery',
        order_date: new Date(),
        tracking_history: [
          { status: 'Order Placed', timestamp: new Date() }
        ]
      });

      // OPTIMIZATION: Use a single update call with 'increment'
      const productsCollectionRef = collection(db, `/artifacts/${appId}/public/data/products`);
      for (const item of cart) {
        const productRef = doc(productsCollectionRef, item.id);
        await updateDoc(productRef, {
          sales_count: increment(item.quantity) // Increment the sales count
        });
      }

      setCart([]); // Clear cart after placing order
      setCurrentView('orders');
      setCheckoutLoading(false); // End loading state for checkout
      setModal({
        isOpen: true,
        type: 'message',
        data: { message: `Order #${newOrderRef.id.slice(0, 8)} has been placed successfully!` }
      });
    } catch (error) {
      console.error("Error placing order:", error);
      setErrorMessage("Failed to place your order. Please try again.");
      setCheckoutLoading(false);
    }
  };

  // Function to get a recipe from the Gemini API
  const getRecipe = async () => {
    if (cart.length === 0) {
      setModal({
        isOpen: true,
        type: 'message',
        data: { message: "Your cart is empty. Add some products to get a recipe!" }
      });
      return;
    }

    setRecipeLoading(true);
    setGeneratedRecipe('');
    setModal({
      isOpen: true,
      type: 'recipe',
      data: { message: 'Generating a recipe for you...'}
    });

    const ingredients = cart.map(item => item.name).join(', ');
    const userPrompt = `Generate a recipe using the following ingredients: ${ingredients}. Provide the recipe title, a brief introduction, a list of ingredients (including quantities if possible), and step-by-step instructions. Please format the response using markdown.`;

    const payload = {
      contents: [{
        parts: [{ text: userPrompt }]
      }],
      tools: [{ "google_search": {} }],
      systemInstruction: {
        parts: [{ text: "You are a helpful culinary assistant. Your task is to generate delicious and simple recipes based on a list of ingredients provided by the user. Do not use any introductory or concluding conversational text in your response." }]
      }
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'No recipe could be generated at this time. Please try again with different ingredients.';
      setGeneratedRecipe(generatedText);
      setModal({
        isOpen: true,
        type: 'recipe',
        data: { message: generatedText }
      });
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      setErrorMessage("Failed to generate a recipe. Please try again.");
      setModal({
        isOpen: true,
        type: 'message',
        data: { message: "Failed to generate a recipe. Please try again." }
      });
    } finally {
      setRecipeLoading(false);
    }
  };

  // Filter products based on the selected category
  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => p.category === selectedCategory);

  // Get best sellers based on sales_count (top 5)
  const bestSellers = [...products].sort((a, b) => b.sales_count - a.sales_count).slice(0, 5);

  // Components to render different views
  const renderProducts = () => (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="container mx-auto">
        {/* Categories Section */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full font-semibold transition-colors duration-200 shadow-md ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-emerald-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Best Sellers Section */}
        {selectedCategory === 'All' && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
              ✨ Best Sellers
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {bestSellers.map((product) => (
                <div
                  key={product.id}
                  onClick={() => setModal({ isOpen: true, type: 'product', data: product })}
                  className="bg-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer border border-yellow-200 transform hover:scale-105"
                >
                  <img src={product.image} alt={product.name} className="w-full h-32 object-cover rounded-md mb-3" />
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{product.name}</h3>
                  <p className="text-sm text-gray-500">{product.farmer.name} from {product.farmer.village}</p>
                  <p className="text-xl font-bold text-indigo-600 mt-2">{formatCurrency(product.price)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                    className="mt-3 w-full bg-indigo-600 text-white py-2 rounded-full font-bold hover:bg-indigo-700 transition-colors duration-200"
                  >
                    Add to Cart
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product List Section */}
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
          {selectedCategory === 'All' ? 'All Products' : `Products in ${selectedCategory}`}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => setModal({ isOpen: true, type: 'product', data: product })}
                className="bg-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer transform hover:scale-105"
              >
                <img src={product.image} alt={product.name} className="w-full h-40 object-cover rounded-md mb-3" />
                <h3 className="text-lg font-bold text-gray-900 mb-1">{product.name}</h3>
                <p className="text-sm text-gray-500">{product.farmer.name}</p>
                <p className="text-xl font-bold text-indigo-600 mt-2">{formatCurrency(product.price)}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                  className="mt-3 w-full bg-indigo-600 text-white py-2 rounded-full font-bold hover:bg-indigo-700 transition-colors duration-200"
                >
                  Add to Cart
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center text-gray-500">No products found in this category.</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCart = () => (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-6">Your Shopping Cart</h2>
        {cart.length > 0 ? (
          <>
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b last:border-b-0 py-4">
                  <div className="flex items-center space-x-4">
                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">From {item.farmer.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="bg-gray-200 text-gray-700 px-2 py-1 rounded-l-md"
                      >
                        -
                      </button>
                      <span className="bg-gray-100 text-gray-800 px-4 py-1">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="bg-gray-200 text-gray-700 px-2 py-1 rounded-r-md"
                      >
                        +
                      </button>
                    </div>
                    <p className="font-bold text-lg text-indigo-600 w-24 text-right">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center bg-white rounded-xl shadow-lg p-6">
              <span className="text-2xl font-bold">Total: {formatCurrency(cart.reduce((total, item) => total + item.price * item.quantity, 0))}</span>
              <div className="flex space-x-4">
                <button
                  onClick={getRecipe}
                  disabled={recipeLoading}
                  className="bg-rose-500 text-white py-3 px-6 rounded-full text-lg font-bold hover:bg-rose-600 transition-colors duration-200 disabled:bg-gray-400"
                >
                  {recipeLoading ? 'Generating...' : '✨ Get Recipe Ideas'}
                </button>
                <button
                  onClick={placeOrder}
                  disabled={checkoutLoading}
                  className="bg-indigo-600 text-white py-3 px-6 rounded-full text-lg font-bold hover:bg-indigo-700 transition-colors duration-200 disabled:bg-gray-400"
                >
                  {checkoutLoading ? 'Processing...' : 'Checkout (Cash on Delivery)'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 p-8 bg-white rounded-xl shadow-lg">Your cart is empty. Start shopping now!</div>
        )}
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-6">Your Orders</h2>
        {orders.length > 0 ? (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Order ID: {order.id.slice(0, 8)}</h3>
                    <p className="text-sm text-gray-500">Order Date: {order.order_date.toDate().toLocaleDateString()}</p>
                    <p className="text-sm text-gray-500">Payment: {order.payment_method}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold text-indigo-600">{formatCurrency(order.total_amount)}</span>
                    <span className="font-bold text-sm rounded-full px-3 py-1 mt-1 text-white bg-green-500">
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Order Live Tracking */}
                <div className="mt-4">
                  <h4 className="font-bold text-lg mb-2">Live Tracking:</h4>
                  <div className="relative">
                    {order.tracking_history && order.tracking_history.map((track, index) => (
                      <div key={index} className="flex items-center mb-2 last:mb-0">
                        <div className="w-4 h-4 bg-indigo-500 rounded-full flex-shrink-0"></div>
                        <div className="ml-4">
                          <p className="font-semibold">{track.status}</p>
                          <p className="text-sm text-gray-500">{new Date(track.timestamp.seconds * 1000).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    {order.tracking_history && order.tracking_history.length < 4 && (
                      <div className="absolute top-0 bottom-0 left-2 w-0.5 bg-gray-200 -z-10"></div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 p-8 bg-white rounded-xl shadow-lg">You have no past orders.</div>
        )}
      </div>
    </div>
  );

  // General-purpose Modal component
  const Modal = ({ children, onClose }) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl p-6 shadow-2xl relative max-w-lg w-full transform transition-all scale-100 opacity-100">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {children}
        </div>
      </div>
    );
  };

  // Render the modal based on its state
  const renderModal = () => {
    if (!modal.isOpen) return null;

    if (modal.type === 'product') {
      const product = modal.data;
      return (
        <Modal onClose={() => setModal({ isOpen: false, type: null, data: null })}>
          <div className="p-4 text-center">
            <img src={product.image} alt={product.name} className="w-full h-64 object-cover rounded-xl mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h2>
            <p className="text-xl font-semibold text-indigo-600 mb-4">{formatCurrency(product.price)}</p>
            <p className="text-gray-600 mb-4">{product.description}</p>
            <div className="bg-gray-100 p-4 rounded-lg text-left">
              <h3 className="font-bold text-lg mb-1">Farmer Details</h3>
              <p className="text-gray-700">Name: {product.farmer.name}</p>
              <p className="text-gray-700">Village: {product.farmer.village}</p>
              <p className="text-gray-700">City: {product.farmer.city}</p>
            </div>
            <button
              onClick={() => {
                addToCart(product);
                setModal({ isOpen: false, type: null, data: null });
              }}
              className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-full font-bold hover:bg-indigo-700 transition-colors"
            >
              Add to Cart
            </button>
          </div>
        </Modal>
      );
    }

    if (modal.type === 'message') {
      return (
        <Modal onClose={() => setModal({ isOpen: false, type: null, data: null })}>
          <div className="p-4 text-center">
            <p className="text-lg font-semibold text-gray-800">{modal.data.message}</p>
          </div>
        </Modal>
      );
    }

    if (modal.type === 'recipe') {
      return (
        <Modal onClose={() => setModal({ isOpen: false, type: null, data: null })}>
          <div className="p-4 text-left max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Your Farm-Fresh Recipe
            </h2>
            {recipeLoading ? (
              <div className="text-center text-gray-500">Generating a recipe for you...</div>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">{generatedRecipe}</p>
            )}
          </div>
        </Modal>
      );
    }

    return null;
  };

  // Show a loading or error state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <p className="text-xl text-gray-700 mb-2">Connecting to the Farm...</p>
          <p className="text-gray-500">Please wait while we load the products.</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-6 bg-red-100 text-red-700 rounded-lg shadow-md">
          <p className="text-xl font-bold mb-2">Error!</p>
          <p>{errorMessage}</p>
        </div>
      </div>
    );
  }

  // Render the main app
  return (
    <div className="min-h-screen bg-gray-100 font-sans leading-normal tracking-normal">
      {/* Tailwind CSS CDN and Font Link */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        body { font-family: 'Inter', sans-serif; }
        .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
        .transform { transform: var(--tw-transform); }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>

      {/* Header with Navigation */}
      <header className="bg-white shadow-md py-4 sticky top-0 z-40">
        <div className="container mx-auto flex justify-between items-center px-4">
          {/* Logo updated here */}
          <img src="https://placehold.co/150x40/228B22/ffffff?text=Farm+to+Home" alt="FARM TO HOME Logo" className="h-10" />
          <nav className="flex items-center space-x-4">
            <button
              onClick={() => setCurrentView('products')}
              className={`font-semibold px-4 py-2 rounded-full transition-colors duration-200 ${currentView === 'products' ? 'bg-emerald-100 text-indigo-600' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              Products
            </button>
            <button
              onClick={() => setCurrentView('orders')}
              className={`font-semibold px-4 py-2 rounded-full transition-colors duration-200 ${currentView === 'orders' ? 'bg-emerald-100 text-indigo-600' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              My Orders
            </button>
            <button
              onClick={() => setCurrentView('cart')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-full font-bold relative hover:bg-indigo-700 transition-colors duration-200 shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5H3m4 8v.5M17 13v.5M10 17.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm10 0a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              Cart
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="py-8">
        {currentView === 'products' && renderProducts()}
        {currentView === 'cart' && renderCart()}
        {currentView === 'orders' && renderOrders()}
      </main>

      {/* User ID display for debugging and collaboration */}
      <div className="fixed bottom-4 left-4 bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full shadow-lg">
        User ID: {userId || 'Authenticating...'}
      </div>

      {renderModal()}
    </div>
  );
};

export default App;
