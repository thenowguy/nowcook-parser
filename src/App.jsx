// ============================== NowCook Parser — v2.0.0 ==============================
// v2.0.0 = Mobile-first multi-page refactor
//  - React Router for page navigation
//  - Timeline-first cooking interface
//  - Simplified mobile UX
/* eslint-disable */
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MealChooser from "./pages/MealChooser";
import SchedulingModal from "./pages/SchedulingModal";
import Runtime from "./pages/Runtime";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MealChooser />} />
        <Route path="/schedule/:mealIdx" element={<SchedulingModal />} />
        <Route path="/runtime/:mealIdx" element={<Runtime />} />
      </Routes>
    </BrowserRouter>
  );
}
