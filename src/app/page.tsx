"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Play, GitBranch, BarChart3, Users } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
            Sugarscape
            <span className="block text-3xl md:text-4xl font-normal text-indigo-600 mt-2">
              Simulation
            </span>
          </h1>
          
          <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto leading-relaxed">
            Explore complex emergent behaviors in an agent-based model where artificial agents compete for resources.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-12"
          >
            <Link href="/sugarscape">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 text-lg">
                <Play className="mr-2 h-5 w-5" />
                Launch Simulation
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid md:grid-cols-3 gap-6 mt-16"
          >
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-6 shadow-lg">
              <Users className="h-12 w-12 text-indigo-600 mb-4 mx-auto" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Agent-Based Modeling</h3>
              <p className="text-gray-600">Watch hundreds of autonomous agents make decisions based on vision, metabolism, and sugar consumption.</p>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-6 shadow-lg">
              <BarChart3 className="h-12 w-12 text-indigo-600 mb-4 mx-auto" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-Time Analytics</h3>
              <p className="text-gray-600">Monitor population dynamics, wealth distribution, and emergent patterns in real-time.</p>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-6 shadow-lg">
              <GitBranch className="h-12 w-12 text-indigo-600 mb-4 mx-auto" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Complex Systems</h3>
              <p className="text-gray-600">Observe how simple rules lead to complex emergent behaviors and social stratification.</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}