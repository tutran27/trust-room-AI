import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../common/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDealDto } from './dto/create-deal.dto';
import { InviteSellerDto } from './dto/invite-seller.dto';
import { ListDealsDto } from './dto/list-deals.dto';
import { TransitionDealDto } from './dto/transition-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { DealsService } from './deals.service';

@Controller('deals')
@UseGuards(JwtAuthGuard)
export class DealsController {
  constructor(@Inject(DealsService) private readonly dealsService: DealsService) {}

  @Post()
  create(@Body() dto: CreateDealDto, @Req() req: AuthenticatedRequest) {
    return this.dealsService.create(dto, req.user.wallet);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest, @Query() query: ListDealsDto) {
    return this.dealsService.findAll(req.user.wallet, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.dealsService.findOne(id, req.user.wallet);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.dealsService.update(id, dto, req.user.wallet);
  }

  @Post(':id/invite')
  inviteSeller(
    @Param('id') id: string,
    @Body() dto: InviteSellerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.dealsService.inviteSeller(id, dto, req.user.wallet);
  }

  @Post(':id/actions')
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionDealDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.dealsService.transition(id, dto, req.user.wallet);
  }

  @Delete(':id')
  cancel(
    @Param('id') id: string,
    @Body() dto: TransitionDealDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.dealsService.cancel(id, dto.expectedVersion, req.user.wallet, dto.reason);
  }
}
