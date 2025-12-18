
import React, { useState } from 'react';

interface StripeSimulationProps {
  onSuccess: () => void;
  onCancel: () => void;
  amount: string;
}

const StripeSimulation: React.FC<StripeSimulationProps> = ({ onSuccess, onCancel, amount }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep('success');
      setTimeout(() => onSuccess(), 1500);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-[#635BFF] p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <i className="fab fa-stripe text-4xl"></i>
            <span className="font-bold opacity-80">Test Mode</span>
          </div>
          <button onClick={onCancel} className="text-white/60 hover:text-white"><i className="fas fa-times"></i></button>
        </div>

        {step === 'form' ? (
          <form onSubmit={handlePay} className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-slate-500 text-sm">S'abonner à</h3>
                <p className="text-xl font-bold text-slate-800">SoleilTerrasse Pro</p>
              </div>
              <div className="text-2xl font-black text-slate-900">{amount}</div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email</label>
                <input type="email" readOnly className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-500 outline-none" value="test@example.com" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Informations de carte</label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex px-4 py-3 bg-white border-b border-slate-200 items-center">
                    <i className="far fa-credit-card text-slate-400 mr-3"></i>
                    <input type="text" placeholder="4242 4242 4242 4242" required className="flex-1 outline-none text-sm" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/2560px-Visa_Inc._logo.svg.png" className="h-3 grayscale opacity-50" />
                  </div>
                  <div className="flex">
                    <input type="text" placeholder="MM / YY" required className="w-1/2 px-4 py-3 outline-none text-sm border-r border-slate-200" />
                    <input type="text" placeholder="CVC" required className="w-1/2 px-4 py-3 outline-none text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nom sur la carte</label>
                <input type="text" placeholder="Nom complet" required className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-[#635BFF]" />
              </div>
            </div>

            <button 
              disabled={isProcessing}
              className="w-full bg-[#635BFF] hover:bg-[#5249e0] text-white py-4 rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : `Payer ${amount}`}
            </button>
            <p className="text-[10px] text-center text-slate-400">
              Paiement sécurisé par Stripe. Aucune donnée réelle n'est enregistrée.
            </p>
          </form>
        ) : (
          <div className="p-12 text-center animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
              <i className="fas fa-check"></i>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Paiement Réussi !</h3>
            <p className="text-slate-500">Bienvenue dans la communauté Pro.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StripeSimulation;
