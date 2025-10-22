mod pool;
pub(crate) use pool::*;

use borsh::BorshDeserialize;

use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, pubkey::Pubkey};

use crate::instruction::AppInstruction;

pub fn process_instruction<'a>(
    _program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction: AppInstruction = AppInstruction::try_from_slice(instruction_data)?;
    match instruction {
        AppInstruction::Create { fee_amount } => {
            msg!("Instruction: Create");
            create(accounts, fee_amount)
        }
        AppInstruction::SetActive { active } => {
            msg!("Instruction: Increment");
            set_active(accounts, active)
        }
        AppInstruction::SetFee { fee_amount } => {
            msg!("Instruction: SetFee");
            set_fee(accounts, fee_amount)
        }
        AppInstruction::Swap => {
            msg!("Instruction: Swap");
            swap(accounts)
        }
        AppInstruction::Deposit => {
            msg!("Instruction: Deposit");
            deposit(accounts)
        }
        AppInstruction::Withdraw => {
            msg!("Instruction: Withdraw");
            withdraw(accounts)
        }
        AppInstruction::Close => {
            msg!("Instruction: Close");
            close(accounts)
        }
    }
}
