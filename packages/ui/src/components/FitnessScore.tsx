// packages/ui/src/components/FitnessScore.tsx
export const FitnessScore = ({ score }: { score: number }) => {
  return (
    <div className="bg-white p-8 border-2 border-void shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">
      <div className="flex justify-between items-end mb-4">
        <span className="font-label text-xs uppercase tracking-widest opacity-50">Architecture Health</span>
        <span className="font-mono text-cyan text-xs">SYS_READY</span>
      </div>
      <div className="text-7xl font-black tracking-tighter">{score}</div>
      <div className="h-2 w-full bg-concrete mt-4">
        <div 
          className="h-full bg-cyan transition-all duration-1000" 
          style={{ width: `${score}%` }} 
        />
      </div>
    </div>
  );
};
