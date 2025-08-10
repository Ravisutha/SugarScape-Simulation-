import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center p-4">
      <Card className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/50 max-w-lg">
        <CardContent className="p-8 text-center space-y-6">
          <h1 className="text-4xl font-bold text-white">Sugarscape Simulation</h1>
          <p className="text-slate-300 text-lg">
            Explore complex emergent behaviors in an agent-based model where artificial agents compete for resources.
          </p>
          <Link href="/sugarscape">
            <Button className="bg-gradient-to-r from-emerald-600/90 to-teal-700/90 hover:from-emerald-700 hover:to-teal-800 text-white border-0 shadow-lg text-lg px-8 py-3">
              Launch Simulation
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
