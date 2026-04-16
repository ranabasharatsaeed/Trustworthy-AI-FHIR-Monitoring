import React from "react";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div>
      <h1>Home Page</h1>
      <nav>
        <Link to="/dashboard">Go to Dashboard</Link> | <Link to="/about">About</Link>
      </nav>
    </div>
  );
};

export default Home;
