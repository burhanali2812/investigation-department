import React, { useEffect, useState } from "react";

function Login() {
  const [name, setName] = useState("");
  const [cnic, setCnic] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState(null);
  const [ip, setIp] = useState("");
  const [device, setDevice] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Capture geolocation quickly and save
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const loc = { latitude, longitude };
          setLocation(loc);
        },
        (err) => {
          setStatus("Location unavailable or permission denied");
        },
        { timeout: 5000 },
      );
    } else {
      setStatus("Geolocation not supported");
    }

    // Gather ip, geolocation and device then save partial record to DB
    const getIP = () =>
      fetch("https://api.ipify.org?format=json")
        .then((r) => r.json())
        .then((data) => (data && data.ip ? data.ip : ""))
        .catch(() => "");

    const getGeo = () =>
      new Promise((res) => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            res({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          () => res(null),
          { timeout: 5000 },
        );
      });

    const ua = navigator.userAgent || "";
    const isMobile = /Mobi|Android|iPhone|iPad|iPod|Opera Mini/i.test(ua);
    const deviceType = isMobile ? "mobile" : "desktop";
    setDevice(deviceType);

    Promise.all([getGeo(), getIP()]).then(([geo, ipAddr]) => {
      const loc = geo
        ? { latitude: geo.latitude, longitude: geo.longitude }
        : null;
      if (loc) setLocation(loc);
      if (ipAddr) setIp(ipAddr);

      // prepare payload matching backend model
      const locPayload = loc
        ? { area: "unknown", coordinates: [loc.longitude, loc.latitude] }
        : { area: "unknown", coordinates: [0, 0] };

      const payload = {
        name: "",
        iPAddress: ipAddr || "",
        location: locPayload,
        deviceType: deviceType,
        cnic: "",
        phoneNumber: "",
      };

      // POST initial partial user record
      fetch("/api/user/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data && data._id) setUserId(data._id);
        })
        .catch(() => {
          // ignore failure; user can still submit later
        });
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("Saving...");

    // Build payload to match backend model
    const locPayload = location
      ? {
          area: "unknown",
          coordinates: [location.longitude, location.latitude],
        }
      : { area: "unknown", coordinates: [0, 0] };

    const payload = {
      name: name.trim(),
      iPAddress: ip || "",
      location: locPayload,
      deviceType: device,
      cnic: cnic.trim(),
      phoneNumber: phone.trim(),
    };

    try {
      if (userId) {
        const res = await fetch(`/api/user/update/${userId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) setStatus("Updated server record");
        else setStatus(`Update failed: ${res.status}`);
      } else {
        const res = await fetch("/api/user/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) setStatus("Saved to server");
        else setStatus(`Server error: ${res.status}`);
      }
    } catch (err) {
      setStatus("Failed to save to server");
    }
  };

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "24px auto",
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>CNIC</label>
          <input
            required
            value={cnic}
            onChange={(e) => setCnic(e.target.value)}
            placeholder="CNIC"
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <button type="submit" style={{ padding: "8px 16px" }}>
          Login
        </button>
      </form>

      <div style={{ marginTop: 16, fontSize: 14, color: "#333" }}>
        <div>
          <strong>Status:</strong> {status || "idle"}
        </div>
        <div>
          <strong>Location:</strong>{" "}
          {location
            ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
            : "not captured"}
        </div>
        <div>
          <strong>IP:</strong> {ip || "not captured"}
        </div>
        <div>
          <strong>Device:</strong> {device || "unknown"}
        </div>
      </div>
    </div>
  );
}

export default Login;
