
import React from 'react';
import { PlatformShip, UserShip, ShipStatus } from '../../../types';

const getStatusColor = (status: ShipStatus) => {
    switch (status) {
        case ShipStatus.Active: return 'bg-green-500/10 text-green-400 border-green-500/30';
        case ShipStatus.Stored: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
        case ShipStatus.Damaged: return 'bg-red-500/10 text-red-400 border-red-500/30';
        case ShipStatus.Lent: return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        case ShipStatus.Sold: return 'bg-slate-700/50 text-slate-500 border-slate-600';
    }
};

const getSizeColor = (size?: string) => {
    switch (size?.toLowerCase()) {
        case 'small': return 'text-green-400';
        case 'medium': return 'text-sky-400';
        case 'large': return 'text-amber-400';
        case 'capital': return 'text-red-400';
        default: return 'text-slate-400';
    }
};

export const ShipCard: React.FC<{
    ship: PlatformShip;
    userShip?: UserShip;
    onClick?: () => void;
    compact?: boolean;
}> = React.memo(({ ship, userShip, onClick, compact }) => {
    if (compact) {
        return (
            <div onClick={onClick} className="flex items-center gap-3 p-2 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-lg hover:border-orange-500/30 hover:bg-slate-900/80 cursor-pointer transition-all group">
                {ship.imageUrl && (
                    <img src={ship.imageUrl} alt={ship.name} className="w-12 h-8 object-cover rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate group-hover:text-orange-200 transition-colors">{userShip?.customName || ship.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">{ship.manufacturer}</p>
                </div>
                {userShip && (
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm border ${getStatusColor(userShip.status)}`}>
                        {userShip.status}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div onClick={onClick} className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 hover:border-orange-500/30 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 shadow-lg hover:shadow-orange-900/20 hover:-translate-y-0.5 group flex flex-col">
            <div className="relative h-36 bg-slate-950 overflow-hidden">
                {ship.imageUrl ? (
                    <img src={ship.imageUrl} alt={ship.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" onError={(e) => { (e.target as HTMLImageElement).src = ''; }} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <i className="fa-solid fa-rocket text-3xl text-slate-700"></i>
                    </div>
                )}
                {userShip && (
                    <span className={`absolute top-2 right-2 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm border backdrop-blur-xs ${getStatusColor(userShip.status)}`}>
                        {userShip.status}
                    </span>
                )}
                {userShip?.isPrimary && (
                    <span className="absolute top-2 left-2 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm border bg-orange-500/20 text-orange-300 border-orange-500/30 backdrop-blur-xs flex items-center gap-1">
                        <i className="fa-solid fa-star text-[8px]"></i>Primary
                    </span>
                )}
                {ship.size && (
                    <span className={`absolute bottom-2 left-2 text-[10px] font-black uppercase tracking-widest ${getSizeColor(ship.size)}`}>
                        {ship.size}
                    </span>
                )}
            </div>

            <div className="p-4 flex-1 flex flex-col">
                <p className="text-sm font-black text-white truncate uppercase tracking-tight group-hover:text-orange-200 transition-colors">
                    {userShip?.customName || ship.name}
                </p>
                {userShip?.customName && (
                    <p className="text-[10px] text-slate-500 truncate">{ship.name}</p>
                )}
                <p className="text-[10px] text-orange-300 font-black uppercase tracking-widest mt-0.5">{ship.manufacturer}</p>

                <div className="flex flex-wrap gap-1.5 mt-3 text-[10px] text-slate-400">
                    {ship.role && (
                        <span className="bg-slate-800/80 border border-slate-700/50 px-2 py-0.5 rounded-sm">{ship.role}</span>
                    )}
                    {ship.crewMax > 1 && (
                        <span className="bg-slate-800/80 border border-slate-700/50 px-2 py-0.5 rounded-sm">
                            <i className="fa-solid fa-users mr-1 text-slate-500"></i>{ship.crewMin}-{ship.crewMax}
                        </span>
                    )}
                    {ship.cargoCapacity > 0 && (
                        <span className="bg-slate-800/80 border border-slate-700/50 px-2 py-0.5 rounded-sm">
                            <i className="fa-solid fa-cube mr-1 text-slate-500"></i>{ship.cargoCapacity} SCU
                        </span>
                    )}
                </div>

                {userShip?.loadoutNotes && (
                    <p className="text-[10px] text-slate-500 mt-2 italic line-clamp-2 leading-relaxed">{userShip.loadoutNotes}</p>
                )}
            </div>
        </div>
    );
});
ShipCard.displayName = 'ShipCard';

export default ShipCard;
