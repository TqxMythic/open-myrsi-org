
import React, { useState, useEffect } from 'react';
import { useFleet } from '../../contexts/FleetContext';
import { useOperations } from '../../contexts/OperationsContext';

import { UserShip } from '../../types';
import WindowFrame from '../layout/WindowFrame';
import ShipPickerDropdown from '../views/fleet/ShipPickerDropdown';
import { useNotification } from '../../contexts/NotificationContext';

interface ManageParticipantModalProps {
    isOpen: boolean;
    onClose: () => void;
    operationId: string;
    participant: {
        userId: number;
        user: { name: string; avatarUrl: string; rank?: { name: string } };
        roleRequested?: string;
        shipUtilized?: string;
        shipId?: number;
        userShipId?: number;
        isReady: boolean;
        attendanceStatus?: string;
    };
    alliedShips?: UserShip[];
}

const ManageParticipantModal: React.FC<ManageParticipantModalProps> = ({ isOpen, onClose, operationId, participant, alliedShips }) => {
    const { updateOperationParticipant } = useOperations();
    const { userShips, refreshFleet } = useFleet();
    const { addToast } = useNotification();
    const [role, setRole] = useState(participant.roleRequested || '');
    const [selectedShipId, setSelectedShipId] = useState<number | null>(participant.userShipId || null);
    const [status, setStatus] = useState(participant.attendanceStatus || 'Registered');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (userShips.length === 0) refreshFleet();
    }, [userShips.length, refreshFleet]);

    const participantShips = alliedShips
        ? alliedShips.filter(s => s.userId === participant.userId)
        : userShips.filter(s => s.userId === participant.userId);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const selectedUserShip = participantShips.find(s => s.id === selectedShipId);
            await updateOperationParticipant(operationId, participant.userId, {
                roleRequested: role.trim() || null,
                shipUtilized: selectedUserShip ? (selectedUserShip.customName || selectedUserShip.ship?.name || null) : null,
                shipId: selectedUserShip?.shipId || null,
                userShipId: selectedUserShip?.id || null,
                attendanceStatus: status
            });
            onClose();
        } catch (err) {
            console.error("Failed to update participant:", err);
            addToast("Update Failed", <i className="fa-solid fa-xmark"></i>, "bg-red-500/10 text-red-400 border-red-500/50", { description: "An error occurred while updating participant details. Please try again." });
        } finally {
            setIsLoading(false);
        }
    };

    const inputClass = "w-full bg-slate-900/60 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/50 outline-hidden transition-all";
    const labelClass = "block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5";

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Manage Participant"
            subtitle={participant.user.name}
            icon="fa-solid fa-user-pen"
            color="purple"
            width="max-w-sm"
        >
            <div className="flex flex-col h-full">
                <div className="p-6 space-y-5">
                    <div className="flex items-center gap-3 mb-4 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                        <img src={participant.user.avatarUrl} alt="" className="w-10 h-10 rounded-full border border-slate-600" />
                        <div>
                            <p className="font-bold text-white text-sm">{participant.user.name}</p>
                            <p className="text-xs text-slate-500 uppercase">{participant.user.rank?.name || 'Member'}</p>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Assigned Role</label>
                        <input
                            type="text"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder="e.g. Lead Pilot, Medic"
                            className={inputClass}
                            disabled={isLoading}
                        />
                    </div>
                    <div>
                        <ShipPickerDropdown
                            ships={participantShips}
                            value={selectedShipId}
                            onChange={(sel) => setSelectedShipId(sel?.userShipId || null)}
                            disabled={isLoading}
                            label="Vehicle / Ship"
                        />
                        {participantShips.length === 0 && (
                            <p className="text-[10px] text-slate-600 mt-1 italic">No ships in hangar — add ships in Fleet Manager</p>
                        )}
                    </div>
                    <div>
                        <label className={labelClass}>Attendance Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className={inputClass}
                            disabled={isLoading}
                        >
                            <option value="Registered">Registered</option>
                            <option value="Attended">Attended</option>
                            <option value="Late">Late</option>
                            <option value="No Show">No Show</option>
                            <option value="Excused">Excused</option>
                        </select>
                    </div>
                </div>

                <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold uppercase text-slate-400 hover:text-white transition-colors" disabled={isLoading}>Cancel</button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/40 shadow-lg shadow-purple-900/30 rounded-lg text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                        disabled={isLoading}
                    >
                        {isLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Update Details'}
                    </button>
                </div>
            </div>
        </WindowFrame>
    );
};

export default ManageParticipantModal;
