void AstGen::VisitPhi(GraphVisitor* v, Inst* inst_base) {
    std::cout << "[+] VisitPhi  >>>>>>>>>>>>>>>>>" << std::endl;
    pandasm::Ins ins;
    [[maybe_unused]] auto enc = static_cast<AstGen*>(v);
    [[maybe_unused]] auto inst = inst_base->CastToPhi();
    panda::es2panda::ir::Expression* funname = enc->get_identifier_byname(enc, new std::string("φ"));
    ArenaVector<es2panda::ir::Expression *> arguments(enc->parser_program_->Allocator()->Adapter());

    for (size_t i = 0; i < inst->GetInputsCount(); i++) {
        std::cout << "[+] phi: end <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<" << std::endl;
        std::cout << "[*] reg " << std::to_string(i) << " , " << std::to_string(inst->GetSrcReg(i-2)) << std::endl;
        auto reg = inst->GetInput(i).GetInst()->GetDstReg();
        arguments.push_back(*enc->get_expression_by_register(enc, reg ));
        std::cout << "[-] phi: end >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" << std::endl;
    }

    auto callexpression = AllocNode<es2panda::ir::CallExpression>(enc, 
                                                        funname,
                                                        std::move(arguments),
                                                        nullptr,
                                                        false
                                                        );
    auto acc_dst = inst->GetDstReg();
    enc->set_expression_by_register(enc, acc_dst, callexpression);

    std::cout << "[-] VisitPhi  <<<<<<<<<<<<<<<" << std::endl;
}

void AstGen::VisitSaveState(GraphVisitor* v, Inst* inst_base) {
    std::cout << "[+] VisitSaveState  >>>>>>>>>>>>>>>>>" << std::endl;
    pandasm::Ins ins;
    [[maybe_unused]] auto enc = static_cast<AstGen*>(v);
    [[maybe_unused]] auto inst = inst_base->CastToSaveState();
    std::cout << "[-] VisitSaveState  >>>>>>>>>>>>>>>>>" << std::endl;
}
void AstGen::VisitParameter(GraphVisitor* v, Inst* inst_base) {
    std::cout << "[+] VisitParameter  >>>>>>>>>>>>>>>>>" << std::endl;
    auto enc = static_cast<AstGen *>(v);
    auto paramInst = inst_base->CastToParameter();

    panda::es2panda::ir::Expression* arg = enc->get_identifier_byname(enc, new std::string("arg" + std::to_string(paramInst->GetArgNumber())));
    
    auto inst_dst_reg = paramInst->GetDstReg();
    
    enc->set_expression_by_register(enc, inst_dst_reg, arg);

    std::cout << "[-] VisitParameter  >>>>>>>>>>>>>>>>>" << std::endl;
}

void AstGen::VisitTry(GraphVisitor* v, Inst* inst_base) {
    std::cout << "[+] VisitTry  >>>>>>>>>>>>>>>>>" << std::endl;
    pandasm::Ins ins;
    auto enc = static_cast<AstGen*>(v);
    auto inst = inst_base->CastToTry();

    // find tryblock
    BasicBlock* tryblock = nullptr;
    if(inst->GetBasicBlock()->GetSuccessor(0)->IsCatchBegin()){
        tryblock = inst->GetBasicBlock()->GetSuccessor(1);
    }else if(inst->GetBasicBlock()->GetSuccessor(1)->IsCatchBegin()){
        tryblock = inst->GetBasicBlock()->GetSuccessor(0);
    }else{
        enc->handleError("can't handle this case  in visitTry for finding try block");
    }

    enc->specialblockid.insert(tryblock->GetId());
    
    panda::es2panda::ir::BlockStatement* tryblock_statement = enc->get_blockstatement_byid(enc, tryblock);

    if(inst->GetBasicBlock()->GetTryId() !=  panda::compiler::INVALID_ID){
        enc->tyrid2block[inst->GetBasicBlock()->GetTryId()] = tryblock_statement;
    }
    

    /// find case block
    auto type_ids = inst->GetCatchTypeIds();
    auto catch_indexes = inst->GetCatchEdgeIndexes();

    panda::es2panda::ir::CatchClause *catchClause = nullptr;
    for (size_t idx = 0; idx < type_ids->size(); idx++) {
        auto succ =  inst->GetBasicBlock()->GetSuccessor(catch_indexes->at(idx));
        
        while (!succ->IsCatchBegin()) {
            succ = succ->GetSuccessor(0);
        }

        enc->specialblockid.insert(succ->GetId());
        auto catch_block = enc->get_blockstatement_byid(enc, succ);
   
        panda::es2panda::ir::Expression *param = enc->constant_catcherror;
        

        catchClause =  AllocNode<panda::es2panda::ir::CatchClause>(enc, nullptr, param, catch_block);
        enc->tyrid2catchclause[inst->GetBasicBlock()->GetTryId()] = catchClause;
    }

    
    if(inst->GetBasicBlock()->GetPredsBlocks().size() == 2){
        enc->handleError("analysis try-catch error for more than one predecessor");
    }
    
    // create null finally case
    ArenaVector<panda::es2panda::ir::Statement *> finally_statements(enc->parser_program_->Allocator()->Adapter());
    panda::es2panda::ir::BlockStatement* finnalyClause = enc->parser_program_->Allocator()->New<panda::es2panda::ir::BlockStatement>(nullptr, std::move(finally_statements));
    
    
    // create try-catch statement
    es2panda::ir::BlockStatement* trycatchStatements = enc->get_blockstatement_byid(enc, inst->GetBasicBlock());

    auto tryStatement = AllocNode<panda::es2panda::ir::TryStatement>(enc, tryblock_statement, catchClause, finnalyClause);
    enc->tyridtrystatement[inst->GetBasicBlock()->GetTryId()] = tryStatement;
    
    const auto &statements = trycatchStatements->Statements();
    trycatchStatements->AddStatementAtPos(statements.size(), tryStatement); 

    std::cout << "[-] VisitTry  >>>>>>>>>>>>>>>>>" << std::endl;

}
