import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ComposeSceneBuilder from '@/components/studio/ComposeSceneBuilder';
import LegacyLabWorkspace from '@/components/studio/LegacyLabWorkspace';

const DIRECT_TOOL_ROUTES = [
  { id: 'pitch_deck', label: 'Pitch Deck Builder', path: '/PitchDecks' },
  { id: 'olo_shop', label: 'Assets Shop', path: '/Catalog' },
];

export default function LabWorkspace(props) {
  const navigate = useNavigate();

  useEffect(() => {
    if (props.directTool === 'pitch_deck') navigate('/PitchDecks');
    if (props.directTool === 'olo_shop') navigate('/Catalog');
  }, [props.directTool, navigate]);

  if (props.directTool === 'compose') {
    return (
      <div className="aistage-tool-surface bg-black p-4 sm:p-6 lg:p-8">
        <ComposeSceneBuilder
          userEmail={props.user?.email}
          onDone={() => {}}
        />
      </div>
    );
  }

  void DIRECT_TOOL_ROUTES;
  return <LegacyLabWorkspace {...props} />;
}
