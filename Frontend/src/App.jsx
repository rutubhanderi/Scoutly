import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [msg, setMsg] = useState("");

  useEffect(() => {
    axios.get("http://localhost:5000/")
      .then(res => setMsg(res.data.message))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Frontend Connected</h1>
      <p>{msg}</p>
    </div>
  );
}

export default App;
