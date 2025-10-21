#!/usr/bin/env zx
import 'zx/globals';
import * as c from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor as renderJavaScriptVisitor } from '@codama/renderers-js';
import { renderVisitor as renderRustVisitor } from '@codama/renderers-rust';
import { getAllProgramIdls } from './utils.mjs';

// Instantiate Codama.
const [idl, ...additionalIdls] = getAllProgramIdls().map((idl) =>
  rootNodeFromAnchor(require(idl))
);
const codama = c.createFromRoot(idl, additionalIdls);

// Update programs.
codama.update(
  c.updateProgramsVisitor({
    midevilsSwap: { name: 'floor-swap' },
  })
);

// Update accounts.
codama.update(
  c.updateAccountsVisitor({
    pool: {
      seeds: [
        c.constantPdaSeedNodeFromString('utf8', 'floor_swap'),
        c.variablePdaSeedNode(
          'authority',
          c.publicKeyTypeNode(),
          'The authority of the pool'
        ),
        c.variablePdaSeedNode(
          'collection',
          c.publicKeyTypeNode(),
          'The collection of the pool'
        ),
      ],
    },
  })
);

// Update instructions.
codama.update(
  c.updateInstructionsVisitor({
    create: {
      byteDeltas: [c.instructionByteDeltaNode(c.accountLinkNode('pool'))],
      accounts: {
        pool: { defaultValue: c.pdaValueNode('pool') },
        payer: { defaultValue: c.accountValueNode('authority') },
      },
    },
    increment: {
      accounts: {
        pool: { defaultValue: c.pdaValueNode('pool') },
      },
      arguments: {
        amount: { defaultValue: c.noneValueNode() },
      },
    },
  })
);

// Set account discriminators.
const key = (name) => ({ field: 'key', value: c.enumValueNode('Key', name) });
codama.update(
  c.setAccountDiscriminatorFromFieldVisitor({
    pool: key('pool'),
  })
);

// Render JavaScript.
const jsClient = path.join(__dirname, '..', 'packages', 'sdk');
codama.accept(
  renderJavaScriptVisitor(path.join(jsClient, 'src', 'generated'), {
    prettierOptions: require(path.join(jsClient, '.prettierrc.json')),
  })
);
