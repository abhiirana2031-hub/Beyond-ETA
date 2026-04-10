import React, { useState, useEffect } from 'react';
import { X, Plus, Phone, User, Trash } from '@phosphor-icons/react';

const EmergencyContactsModal = ({ isOpen, onClose }) => {
  const [contacts, setContacts] = useState([]);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('emergencyContacts');
    if (saved) {
      setContacts(JSON.parse(saved));
    }
  }, []);

  const saveContacts = (updatedContacts) => {
    localStorage.setItem('emergencyContacts', JSON.stringify(updatedContacts));
    setContacts(updatedContacts);
  };

  const addContact = () => {
    if (newContact.name.trim() && newContact.phone.trim()) {
      const updated = [...contacts, { ...newContact, id: Date.now() }];
      saveContacts(updated);
      setNewContact({ name: '', phone: '' });
      setIsAdding(false);
    }
  };

  const deleteContact = (id) => {
    const updated = contacts.filter(c => c.id !== id);
    saveContacts(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white heading-font">Emergency Contacts</h3>
          <button
            onClick={onClose}
            className="text-[#A1A1AA] hover:text-white transition-colors"
          >
            <X size={24} weight="bold" />
          </button>
        </div>

        {/* Contact List */}
        <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="text-center py-8 text-[#A1A1AA] text-sm">
              No emergency contacts added yet
            </div>
          ) : (
            contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-3 bg-[#121212] border border-[#1A1A1A] rounded-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#D500F9]/20 rounded-full flex items-center justify-center">
                    <User size={20} className="text-[#D500F9]" weight="fill" />
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{contact.name}</div>
                    <div className="text-[#A1A1AA] text-xs flex items-center gap-1">
                      <Phone size={12} />
                      {contact.phone}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteContact(contact.id)}
                  className="text-[#FF3366] hover:text-white transition-colors"
                >
                  <Trash size={18} weight="bold" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add New Contact */}
        {isAdding ? (
          <div className="space-y-3 p-4 bg-[#121212] rounded-sm">
            <input
              type="text"
              placeholder="Contact Name"
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-[#1A1A1A] rounded-sm py-2 px-3 text-white placeholder-[#71717A] focus:outline-none focus:border-white/20"
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={newContact.phone}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-[#1A1A1A] rounded-sm py-2 px-3 text-white placeholder-[#71717A] focus:outline-none focus:border-white/20"
            />
            <div className="flex gap-2">
              <button
                onClick={addContact}
                className="flex-1 bg-[#D500F9] text-white py-2 rounded-sm font-bold text-sm hover:bg-[#D500F9]/80 transition-colors"
              >
                Save Contact
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewContact({ name: '', phone: '' });
                }}
                className="flex-1 bg-[#1A1A1A] text-white py-2 rounded-sm font-bold text-sm hover:bg-[#2A2A2A] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full bg-[#121212] border border-[#1A1A1A] py-3 rounded-sm font-bold text-white hover:bg-[#1A1A1A] transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={20} weight="bold" />
            Add New Contact
          </button>
        )}

        <div className="mt-6 p-3 bg-[#D500F9]/10 border border-[#D500F9]/30 rounded-sm">
          <p className="text-xs text-[#A1A1AA]">
            <span className="text-[#D500F9] font-bold">Note:</span> These contacts will receive your live location and SOS alerts when you trigger the emergency button.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmergencyContactsModal;
