import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 首頁就是登入頁 */}
        <Route path="/" element={<LoginPage />} />

        {/* 如果還要保留 /login 路徑，也可以指向同一個 LoginPage */}
        <Route path="/login" element={<LoginPage />} />

        {/* 未知路由 → 404 */}
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}
